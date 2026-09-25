#!/usr/bin/env node
/**
 * keeper.js - keep Claude's 5-hour usage windows chained back to back.
 *
 * A 5h window only starts on the first request after the previous one has closed.
 * Opening the next one as soon as the previous one closes means a work session lands
 * at a random point in a running window (2.5h to reset on average) instead of always
 * opening a fresh 5h.
 *
 * Each run (Task Scheduler, every 10 min, via keeper.vbs):
 *   1. The stored window end is still in the future -> exit. Local file read, no network.
 *      The claude-code-vsc-statusline cache is fresh and shows a running window
 *      -> store its end time and exit, no ping.
 *      Inside the 5h before morning_anchor -> exit, so the day's first window opens at the anchor.
 *   2. Otherwise -> one headless ping (`claude -p` on Haiku, no transcript, no user hooks),
 *      which also refreshes the OAuth token.
 *   3. Read the real window end from the usage endpoint (the token is fresh now, so this
 *      works after any absence) and store it for step 1.
 * A ping into a window that is already open changes nothing; the read after it just
 * picks up that window's real end time.
 *
 * Settings: keeper.conf next to this file.
 * Runtime files (Windows: %LOCALAPPDATA%\window-keeper, elsewhere: ~/.local/state/window-keeper):
 *   state.json  {resetsAt}
 *   keeper.log  one JSON line per ping
 *   ping-cwd/   working directory of the ping (no .claude/ inside -> no project settings)
 *
 * USAGE
 *   node keeper.js           normal run
 *   node keeper.js --status  print state and the last log lines, change nothing
 *   node keeper.js --ping    ping and re-read the window now, skipping the checks in step 1
 *
 * Requires Node 18+. No dependencies.
 */

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFile, execFileSync } = require('child_process');

const HOME = os.homedir();
const RUN_DIR = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'window-keeper')
  : path.join(process.env.XDG_STATE_HOME || path.join(HOME, '.local', 'state'), 'window-keeper');
const STATE_PATH = path.join(RUN_DIR, 'state.json');
const LOG_PATH = path.join(RUN_DIR, 'keeper.log');
const LOCK_PATH = path.join(RUN_DIR, 'keeper.lock');
const PING_CWD = path.join(RUN_DIR, 'ping-cwd');
const CONF_PATH = path.join(__dirname, 'keeper.conf');
const CREDENTIALS_PATH = path.join(HOME, '.claude', '.credentials.json');
// Written by the claude-code-vsc-statusline extension while VSCode is open.
const USAGE_CACHE_PATH = path.join(os.tmpdir(), 'claude', 'statusline-usage-cache.json');

const PING_ARGS = [
  '-p',
  '--no-session-persistence',
  '--setting-sources', 'project',
  '--model', 'haiku',
  'Reply with the single word: pong',
];
const RESET_MARGIN_MS = 30 * 1000;   // don't ping in the same second the server closes the window
const CACHE_FRESH_MS = 5 * 60 * 1000;
const PING_TIMEOUT_MS = 90 * 1000;
const POLL_ATTEMPTS = 4;
const POLL_RETRY_MS = 60 * 1000;     // ping + 4 attempts stay inside the task's 5-minute limit
const LOCK_STALE_MS = 5 * 60 * 1000;
const WINDOW_MS = 5 * 60 * 60 * 1000;

const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const iso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// keeper.conf: key=value lines, # comments. A missing file or key means the default.
function readConf() {
  const conf = {};
  try {
    for (const line of fs.readFileSync(CONF_PATH, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([a-z_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) conf[m[1]] = m[2];
    }
  } catch { /* no conf */ }
  return conf;
}

function parseAnchor(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

function claudeBin(conf) {
  if (conf.claude_path) return conf.claude_path;
  for (const name of ['claude.exe', 'claude']) {
    const abs = path.join(HOME, '.local', 'bin', name);
    if (fs.existsSync(abs)) return abs;
  }
  return 'claude';
}

function run(bin, args, opts) {
  return new Promise(resolve => {
    const started = Date.now();
    execFile(bin, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      resolve({
        code: err ? (typeof err.code === 'number' ? err.code : -1) : 0,
        out: (stdout || '').trim(),
        err: (stderr || (err && err.message) || '').trim(),
        ms: Date.now() - started,
      });
    });
  });
}

/** Same lookup order as Claude Code: env, credentials file, macOS keychain. */
function getOAuthToken() {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const fromJson = s => {
    try { const d = JSON.parse(s); return (d && d.claudeAiOauth && d.claudeAiOauth.accessToken) || ''; } catch { return ''; }
  };
  try {
    const t = fromJson(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    if (t) return t;
  } catch { /* no credentials file */ }
  if (process.platform === 'darwin') {
    try {
      return fromJson(execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
        { timeout: 5000, encoding: 'utf8' }).trim());
    } catch { /* no keychain entry */ }
  }
  return '';
}

// The subscription usage endpoint (the statusline extension reads the same one). Costs no model tokens.
function fetchUsage(token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('request timed out')));
    req.end();
  });
}

const windowOf = data => {
  const fh = (data && data.five_hour) || {};
  return { resetsAt: fh.resets_at ? Date.parse(fh.resets_at) : NaN, utilization: fh.utilization };
};

// The statusline extension's cache, when it was fetched at or after `since`.
function cachedWindow(since) {
  const c = readJson(USAGE_CACHE_PATH);
  if (!c || !c.data || !(c.fetchedAt >= since)) return null;
  return { ...windowOf(c.data), source: 'cache' };
}

// Real window end, as seen after `since`. Right after a ping the endpoint can still report
// no window, and it rate-limits hard (429). Either way: wait and retry, taking the
// statusline extension's fresher cache if it lands in the meantime.
async function readWindow(since, attempts) {
  let last = { resetsAt: NaN };
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) {
      await sleep(POLL_RETRY_MS);
      const c = cachedWindow(since);
      if (c && c.resetsAt > Date.now()) return c;
    }
    const token = getOAuthToken();
    if (!token) return { resetsAt: NaN, error: 'no OAuth token: is Claude Code logged in with a subscription?' };
    try {
      const res = await fetchUsage(token);
      if (res.status !== 200) { last = { resetsAt: NaN, error: `usage endpoint HTTP ${res.status}` }; continue; }
      const win = { ...windowOf(JSON.parse(res.body)), source: 'poll' };
      if (win.resetsAt > Date.now()) return win;
      last = { ...win, error: 'no window reported yet' };
    } catch (e) {
      last = { resetsAt: NaN, error: 'usage read failed: ' + e.message };
    }
  }
  return last;
}

// Chaining keeps the phase set by the previous night's work, so the morning window can land at
// any offset from the user's start. A window opened in the 5h before the anchor would still be
// running at the anchor and push the whole day later -> hold pings in that stretch.
function inMorningHold(now, anchor) {
  if (!anchor) return false;
  const next = new Date(now);
  next.setHours(anchor.h, anchor.m, 0, 0);
  if (next.getTime() <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now <= WINDOW_MS;
}

function status() {
  const s = readJson(STATE_PATH) || {};
  const conf = readConf();
  const anchor = parseAnchor(conf.morning_anchor);
  console.log('window ends:   ', Number.isFinite(s.resetsAt) ? `${new Date(s.resetsAt).toLocaleString()} (from ${s.source})` : '(none stored)');
  console.log('morning anchor:', anchor ? conf.morning_anchor : '(off)');
  console.log('claude:        ', claudeBin(conf));
  try {
    const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n');
    console.log('\nlast pings:\n' + lines.slice(-10).join('\n'));
  } catch { console.log('\n(no pings logged yet)'); }
}

async function main() {
  if (process.argv.includes('--status')) return status();
  fs.mkdirSync(PING_CWD, { recursive: true });

  const conf = readConf();
  const now = Date.now();
  const state = readJson(STATE_PATH) || {};
  if (!process.argv.includes('--ping')) {
    if (Number.isFinite(state.resetsAt) && now < state.resetsAt + RESET_MARGIN_MS) return;

    // VSCode is open and already shows a running window -> adopt its end time, no ping needed
    const live = cachedWindow(now - CACHE_FRESH_MS);
    if (live && live.resetsAt > now + RESET_MARGIN_MS) {
      fs.writeFileSync(STATE_PATH, JSON.stringify({ resetsAt: live.resetsAt, updatedAt: now, source: 'cache' }, null, 2));
      return;
    }

    if (inMorningHold(now, parseAnchor(conf.morning_anchor))) return;
  }

  // one ping at a time
  try {
    const st = fs.statSync(LOCK_PATH);
    if (now - st.mtimeMs < LOCK_STALE_MS) return;
  } catch { /* no lock */ }
  fs.writeFileSync(LOCK_PATH, String(process.pid));

  try {
    const pingAt = Date.now();
    const ping = await run(claudeBin(conf), PING_ARGS, { cwd: PING_CWD, timeout: PING_TIMEOUT_MS });
    // a failed ping opened nothing -> one read is enough to see whether a window runs anyway
    const win = await readWindow(pingAt, ping.code === 0 ? POLL_ATTEMPTS : 1);
    const ok = Number.isFinite(win.resetsAt) && win.resetsAt > Date.now();

    // not ok -> leave resetsAt empty so the next run tries again
    fs.writeFileSync(STATE_PATH, JSON.stringify({ resetsAt: ok ? win.resetsAt : null, updatedAt: Date.now(), source: win.source }, null, 2));
    fs.appendFileSync(LOG_PATH, JSON.stringify({
      pingAt: iso(pingAt),
      prevResetsAt: iso(state.resetsAt),
      pingExit: ping.code,
      pingMs: ping.ms,
      pingOut: ping.code === 0 ? ping.out.slice(0, 40) : (ping.out + ' ' + ping.err).slice(0, 300),
      resetsAt: iso(win.resetsAt),
      utilization: win.utilization,
      source: win.source,
      result: ok ? 'window-open' : 'no-window',
      error: ok ? undefined : win.error,
    }) + '\n');
  } finally {
    try { fs.unlinkSync(LOCK_PATH); } catch { /* already gone */ }
  }
}

if (require.main === module) {
  main().catch(e => {
    try { fs.appendFileSync(LOG_PATH, JSON.stringify({ at: new Date().toISOString(), fatal: e.message }) + '\n'); } catch { /* nowhere to report */ }
    process.exit(1);
  });
}

module.exports = { inMorningHold, parseAnchor };
