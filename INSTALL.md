# INSTALL - Window Keeper

**מטרת הקובץ:** מנהל את ההתקנה של Window Keeper. קורא: Claude (המודל שמבצע את ההתקנה עבור המשתמש).

## כללי על (אל תעבור עליהם)

- **כל התקשורת עם המשתמש בעברית.** מונחים טכניים (פקודות, נתיבים, קוד) נשארים באנגלית בתוך הטקסט העברי.
- **אל תכתוב כלום לדיסק ואל תרשום משימה עד שהמשתמש אישר את התוכנית** (Phase 3). הבדיקות ב-Phase 1 קוראות בלבד.
- **כל שאלה למשתמש עוברת דרך הכלי `AskUserQuestion`** (חלונית popup מובנית של Claude Code), **לא** בטקסט רגיל. אם הכלי לא זמין ברשימה הישירה, קרא קודם ל-`ToolSearch` עם `select:AskUserQuestion`.
- **לעולם אל תדפיס את קובץ ההתחברות או טוקן.** בדיקת ההתחברות מחזירה `true` או `false` ותו לא.
- **לא נדרשות הרשאות מנהל**, ואין לכתוב מחוץ לשתי התיקיות: `%USERPROFILE%\.claude\scripts\window-keeper\` (הקוד וההגדרות) ו-`%LOCALAPPDATA%\window-keeper\` (נוצרת לבד בריצה הראשונה).

הפקודות כאן כתובות ל-PowerShell. מ-Git Bash, `~/.claude/...` במקום `$env:USERPROFILE\.claude\...`.

---

## Phase 0 - פתיחה

הצג למשתמש פתיחה קצרה, ועבור מיד ל-Phase 1 (היא קוראת בלבד, אין צורך לחכות לאישור):

> ברוך הבא להתקנת Window Keeper. הוא דואג שחלון המכסה של 5 השעות תמיד ירוץ, כך שכשאתה מתיישב לעבוד נשארות בממוצע שעתיים וחצי עד האיפוס, במקום 5 שעות מלאות. אני בודק עכשיו את הדרישות, אחר כך אשאל שאלה אחת על שעות העבודה שלך, ורק אחרי שתאשר אתקין.

---

## Phase 1 - בדיקת דרישות ומצב קיים

הרץ את הבדיקות במקביל כשאפשר:

1. **Windows.** אם המערכת אינה Windows: עצור והסבר שההתקנה רושמת משימה מתוזמנת של Windows. `keeper.js` עצמו אמור לרוץ גם מ-cron כל 10 דקות, אבל זה לא נבדק והאשף לא מתקין את זה.
2. **Node.js 18 ומעלה:** `node --version`.
3. **Claude Code בהתקנה נייטיב:** `Test-Path "$env:USERPROFILE\.local\bin\claude.exe"`.
   - לא קיים ← `where.exe claude`. נמצא `claude.exe` במקום אחר ← רשום את הנתיב המלא בשביל `claude_path` ב-Phase 4.
   - נמצא רק `claude.cmd` (התקנת npm) ← עצור ובקש מהמשתמש להריץ `claude install` ולחזור. משימה מתוזמנת לא יכולה להפעיל את `claude.cmd` ישירות.
4. **התחברות עם מנוי:**
   ```
   node -e "try{const c=require(require('os').homedir()+'/.claude/.credentials.json');console.log(Boolean(c.claudeAiOauth&&c.claudeAiOauth.accessToken))}catch(e){console.log(false)}"
   ```
   `false` ← עצור והסבר: Window Keeper דורש Claude Code מחובר למנוי Pro או Max (`/login`). עם מפתח API אין חלון של 5 שעות, ואין מה לשמור.
5. **התקנה קיימת:** האם התיקייה `%USERPROFILE%\.claude\scripts\window-keeper\` קיימת, והאם יש משימה (`Get-ScheduledTask -TaskName Claude-Window-Keeper -ErrorAction SilentlyContinue`). אם יש `keeper.conf`, קרא ממנו את `morning_anchor` ואת `claude_path`.
6. **שורת הסטטוס** (מידע בלבד): האם קיים `$env:TEMP\claude\statusline-usage-cache.json`. אם כן, התוסף `claude-code-vsc-statusline` מותקן ורץ.

דווח למשתמש בפורמט הזה:

```
בדקתי. הנה מה שמצאתי:

• Windows: ✓
• Node.js: [גרסה] ✓
• Claude Code: [נתיב] ✓
• התחברות: מנוי ✓
• התקנה קיימת: [אין / יש, עוגן בוקר: HH:MM או כבוי]
• שורת הסטטוס: [מותקנת / לא מותקנת]
```

**דרישה אחת נכשלה ← עצור כאן.** הסבר מה חסר ואיך מתקנים, ואל תמשיך לשאלות.

---

## Phase 2 - שעות העבודה (עוגן הבוקר)

הסבר קודם, בשניים-שלושה משפטים:

> השרשור ממשיך את השעות שנקבעו בלילה הקודם. בלי עוגן, החלון של הבוקר יכול להיפתח בדיוק כשאתה מתיישב, ואז שוב יש 5 שעות מלאות עד האיפוס. עוגן בוקר גורם לחלון הראשון של היום להיפתח שעתיים וחצי לפני שאתה מתחיל, כך שתגיע בדיוק לאמצע שלו.

**התקנה חדשה, או התקנה קיימת בלי עוגן:** שאל דרך `AskUserQuestion`:

> מתי אתה בדרך כלל מתחיל לעבוד עם Claude?
>
> - **בערך ב-8:00** ← עוגן ב-05:30
> - **בערך ב-9:00** ← עוגן ב-06:30
> - **בערך ב-10:00** ← עוגן ב-07:30
> - **אין לי שעה קבועה** ← בלי עוגן. החלונות משורשרים מסביב לשעון

תשובה חופשית (Other) עם שעה ← העוגן הוא השעה פחות שעתיים וחצי, מודולו 24 שעות (01:00 ← 22:30). תשובה שאינה שעה ← שאל שוב.

**התקנה קיימת עם עוגן:** שאל קודם דרך `AskUserQuestion`:

> העוגן הנוכחי הוא HH:MM: החלון הראשון של היום נפתח אז. להשאיר אותו?
>
> - **להשאיר HH:MM** (מומלץ)
> - **לשנות** ← שאל את שאלת שעת ההתחלה שלמעלה

---

## Phase 3 - אישור התוכנית

הצג את התוכנית:

```
זה מה שאעשה:

1. אוריד את keeper.js, keeper.vbs ו-register-task.ps1
   לתיקייה %USERPROFILE%\.claude\scripts\window-keeper\   [בהתקנה קיימת: אחליף את הקיימים]
2. keeper.conf: [ייווצר עם morning_anchor=HH:MM / יעודכן רק בשורת morning_anchor / יישאר כמו שהוא]
3. ארשום משימה מתוזמנת בשם Claude-Window-Keeper:
   כל 10 דקות, מוסתרת, למשתמש שלך, בלי הרשאות מנהל
4. אבדוק שהכול עובד: פינג אחד, וקריאה של שעת הסגירה של החלון הנוכחי
```

ושאל דרך `AskUserQuestion`: **להתקין?** עם האפשרויות **התקן** ו-**בטל**. בוטל ← עצור בלי לגעת בכלום.

---

## Phase 4 - התקנה

**1. הורדת הקבצים.** בסיס: `https://raw.githubusercontent.com/arielmoatti/claude-code-window-keeper/main/`

```powershell
$dir = "$env:USERPROFILE\.claude\scripts\window-keeper"
New-Item -ItemType Directory -Force $dir | Out-Null
$base = 'https://raw.githubusercontent.com/arielmoatti/claude-code-window-keeper/main'
foreach ($f in 'keeper.js', 'keeper.vbs', 'register-task.ps1') { curl.exe -fsSL -o "$dir\$f" "$base/$f" }
if (-not (Test-Path "$dir\keeper.conf")) { curl.exe -fsSL -o "$dir\keeper.conf" "$base/keeper.conf" }
```

`curl.exe` ולא `curl`: ב-PowerShell 5.1, `curl` הוא כינוי ל-`Invoke-WebRequest`.

**2. ההגדרות.** ערוך ב-`keeper.conf` רק את השורות הרלוונטיות, ואל תיגע בשאר:
- `morning_anchor=HH:MM` לפי Phase 2, או `morning_anchor=` ריק כשאין שעה קבועה
- `claude_path=<נתיב מלא>` רק אם `claude.exe` נמצא מחוץ ל-`~/.local/bin` ב-Phase 1

**3. רישום המשימה:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\window-keeper\register-task.ps1"
```

הפלט הצפוי: `Claude-Window-Keeper: Ready, every PT10M`.

**`Access is denied` בהתקנה קיימת** ← המשימה נרשמה בעבר מסשן עם הרשאות מנהל, וסשן רגיל לא יכול לדרוס אותה. בדוק את הפעולה שלה: `(Get-ScheduledTask -TaskName Claude-Window-Keeper).Actions.Arguments`. היא כבר מצביעה על אותו `keeper.vbs` ← אין צורך ברישום מחדש, דלג על השלב. אחרת ← בקש מהמשתמש להריץ את פקודת הרישום מ-PowerShell שנפתח כמנהל.

**4. בדיקה:**

```powershell
node "$env:USERPROFILE\.claude\scripts\window-keeper\keeper.js" --ping
node "$env:USERPROFILE\.claude\scripts\window-keeper\keeper.js" --status
```

השיחה הזאת עצמה כבר רצה בתוך חלון, ולכן הפינג לא משנה כלום. הוא רק רושם מתי החלון הנוכחי נסגר. הוא לוקח בין 10 שניות ל-5 דקות, אז הרץ אותו עם timeout של 6 דקות.

- **הצלחה:** בשורה `window ends:` מופיעה שעה בתוך 5 השעות הקרובות.
- **`(none stored)`:** קרא את השורה האחרונה תחת `last pings`. `pingExit` שאינו 0 ← הפינג נכשל, הצג את `pingOut`. `error: no window reported yet` ← השרת עוד לא עדכן. הריצה המתוזמנת הבאה, תוך 10 דקות, מנסה שוב לבד.

---

## Phase 5 - סיכום

```
ההתקנה הושלמה.

• המשימה Claude-Window-Keeper רצה כל 10 דקות, מוסתרת
• החלון הנוכחי נסגר ב-HH:MM, ומיד אחרי זה השומר יפתח את הבא
• עוגן בוקר: [HH:MM / כבוי]. לשינוי: השורה morning_anchor בקובץ keeper.conf

בדיקת מצב:  node "%USERPROFILE%\.claude\scripts\window-keeper\keeper.js" --status
עצירה:       Disable-ScheduledTask -TaskName Claude-Window-Keeper
הסרה מלאה:   ב-README, תחת "פקודות"
```

**שורת הסטטוס לא מותקנת (Phase 1)** ← הוסף שורה אחת: עם התוסף [claude-code-vsc-statusline](https://github.com/arielmoatti/claude-code-vsc-statusline) רואים ב-VS Code את החלון ואת הזמן עד האיפוס בזמן אמת.

---

## הערות למבצע (Claude)

- **אין פעולה מרוחקת מלבד הורדת הקבצים.** בלי `git`, בלי העלאה, בלי שליחה.
- **משהו נכשל** (הרשאה, הורדה, רישום) ← ספר למשתמש מה קרה ושאל איך להמשיך. אל תמציא תוצאות.
- **המשתמש מתנגד באמצע** ← עצור מיד, סכם מה נעשה ומה לא, ובקש הוראות.
