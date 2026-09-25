<div dir="rtl">

# שומר החלון ל-Claude Code: פחות המתנה לאיפוס המכסה

מכסת 5 השעות של מנוי Claude לא מתחילה בשעה קבועה. היא מתחילה בפנייה הראשונה אחרי שהחלון הקודם נסגר. לכן כשמתיישבים לעבוד אחרי הפסקה, נפתח חלון חדש, ויש 5 שעות מלאות עד האיפוס. אם חיסלת את המכסה אחרי שעתיים בלבד, עכשיו אתה תקוע שלוש שעות...

**שומר החלון (Window Keeper) לא נותן לחלון להיות סגור.** ברגע שחלון נסגר, משימה מתוזמנת שולחת פנייה זעירה אחת ופותחת את הבא. כך כל ישיבה נוחתת איפשהו בתוך חלון שכבר רץ, ובממוצע נשארות בו שעתיים וחצי עד האיפוס.

<p align="center"><img src="statusbar.png" alt="שורת הסטטוס: 0% ניצול, 35 דקות עד האיפוס"></p>

<h6 dir="rtl" align="center"><i>לדוגמה, התיישבתי לראשונה מול המחשב: אני ב- 0% ניצול, ורק 35 דקות עד האיפוס. אפשר לשרוף עכשיו מכסה מלאה, ובעוד חצי שעה מתקבלת עוד אחת.</i></h6>

---

## כמה זה חוסך

זמן ההמתנה עד האיפוס הראשון, ביום שבו המכסה נגמרת:

<table dir="rtl">
<tr><th>המכסה נגמרת אחרי</th><th>בלי השומר</th><th>עם השומר (בממוצע)</th></tr>
<tr><td>שעה</td><td>4 שעות</td><td>שעה ו-36 דקות</td></tr>
<tr><td>שעתיים</td><td>3 שעות</td><td>54 דקות</td></tr>
<tr><td>3 שעות</td><td>שעתיים</td><td>24 דקות</td></tr>
</table>

<ul dir="rtl">
<li><b>זה עוזר רק בימים שבהם המכסה נגמרת.</b> ביום קל אין הבדל, לא לטובה ולא לרעה.</li>
<li><b>המכסה השבועית לא משתנה.</b> השומר משנה רק מתי מתאפס חלון 5 השעות, לא כמה אפשר לשרוף בשבוע.</li>
<li><b>המחשב צריך להיות דלוק ומחובר למשתמש שלכם</b> (מסך נעול זה בסדר). כשהוא כבוי או ישן, לא נפתח חלון. כשהוא מתעורר, השומר ממשיך לבד.</li>
</ul>

---

## איך זה עובד

משימה מתוזמנת של Windows רצה כל 10 דקות, בלי חלון ובלי הבזק:

<ol dir="rtl">
<li><b>חלון עדיין רץ ←</b> יוצאים מיד. זו קריאה של קובץ מקומי אחד, בלי רשת, וכך נגמרות כמעט כל הריצות.</li>
<li><b>החלון נסגר ←</b> פנייה זעירה אחת למודל Haiku, שעונה במילה אחת. הפנייה פותחת חלון חדש.</li>
<li><b>מיד אחריה ←</b> השומר קורא מהשרת מתי החלון החדש ייסגר, ושומר את השעה בשביל שלב 1.</li>
</ol>

פנייה לתוך חלון שכבר פתוח לא משנה כלום, ולכן אין סיכון לקצר חלון קיים.

### עוגן בוקר

השרשור ממשיך את השעות שנקבעו בלילה הקודם. אחרי לילה ארוך, השעות יכולות להסתדר כך שהחלון של הבוקר נפתח בדיוק כשמתיישבים, וחוזרים ל-5 שעות מלאות עד האיפוס.

**עוגן בוקר פותר את זה.** בחמש השעות שלפני העוגן השומר לא שולח פנייה, ולכן החלון הראשון של היום נפתח בדיוק בשעת העוגן. השעה המומלצת היא שעתיים וחצי לפני שמתחילים לעבוד: מתחילים ב-10:00? עוגן ב-07:30, והחלונות נסגרים ב-12:30, ב-17:30 וב-22:30. עבודה בתוך חמש השעות האלה פותחת חלון בעצמה, ואת זה העוגן לא יכול לתקן.

אשף ההתקנה שואל מתי אתם מתחילים לעבוד וקובע את העוגן לבד. לשינוי בהמשך: השורה `morning_anchor` בקובץ `keeper.conf`. שורה ריקה מבטלת את העוגן.

---

## דרישות

<ul dir="rtl">
<li>מערכת Windows 10 או 11</li>
<li>סביבת Node.js בגרסה 18 ומעלה</li>
<li>כלי Claude Code בהתקנה הנייטיב (<code>claude.exe</code> תחת <code>~/.local/bin</code>), מחובר <b>למנוי</b> Pro או Max. עם מפתח API אין חלון של 5 שעות, ואין מה לשמור</li>
</ul>

---

## התקנה

### התקנה מהירה (הדבקה לתוך Claude Code)

פותחים שיחה ב-Claude Code ומדביקים את הבלוק:

<div dir="ltr">

```
Install Window Keeper from https://raw.githubusercontent.com/arielmoatti/claude-code-window-keeper/main/INSTALL.md - read the file and follow it exactly. Communicate with me in Hebrew throughout.
```

</div>

&rlm;Claude יבדוק את הדרישות, ישאל מתי אתם מתחילים לעבוד בדרך כלל, יציג מה הוא עומד לעשות, ורק אחרי אישור יתקין ויוודא שהכול עובד. לא נדרשות הרשאות מנהל.

### התקנה ידנית

<ol dir="rtl">
<li>מעתיקים את <code>keeper.js</code>, <code>keeper.vbs</code>, <code>keeper.conf</code> ו-<code>register-task.ps1</code> לתיקייה <code>%USERPROFILE%\.claude\scripts\window-keeper\</code></li>
<li>קובעים עוגן בוקר ב-<code>keeper.conf</code> (אופציונלי)</li>
<li>רושמים את המשימה המתוזמנת:</li>
</ol>

<div dir="ltr">

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\window-keeper\register-task.ps1"
```

</div>

---

## פקודות

<div dir="ltr">

```powershell
# When does the current window close, and the last pings
node "$env:USERPROFILE\.claude\scripts\window-keeper\keeper.js" --status

# Ping and read the window now, without waiting for the next run
node "$env:USERPROFILE\.claude\scripts\window-keeper\keeper.js" --ping

# Pause / resume
Disable-ScheduledTask -TaskName Claude-Window-Keeper
Enable-ScheduledTask -TaskName Claude-Window-Keeper

# Uninstall
Unregister-ScheduledTask -TaskName Claude-Window-Keeper -Confirm:$false
Remove-Item -Recurse "$env:USERPROFILE\.claude\scripts\window-keeper", "$env:LOCALAPPDATA\window-keeper"
```

</div>

---

## טביעת רגל

<table dir="rtl">
<tr><th>מה</th><th>כמה</th></tr>
<tr><td>פניות למודל</td><td>אחת לכל חלון, כלומר בערך חמש ביום, כולן ל-Haiku. הן קטנות מכדי להזיז את מד הניצול</td></tr>
<tr><td>היסטוריית שיחות</td><td>אין. הפנייה לא נשמרת כשיחה</td></tr>
<tr><td>ה-hooks וההגדרות הגלובליות שלכם</td><td>לא נטענים בפנייה</td></tr>
<tr><td>תהליכים</td><td>הרצה קצרה של node כל 10 דקות. כמעט כולן קוראות קובץ אחד ויוצאות תוך פחות מעשירית שנייה</td></tr>
<tr><td>קבצים</td><td>מצב ויומן ב-<code>%LOCALAPPDATA%\window-keeper\</code>, ועוד תיקייה ריקה אחת תחת <code>~/.claude/projects</code></td></tr>
</table>

---

## עובד יחד עם שורת הסטטוס

מי שעובד ב-VS Code יכול לראות את השרשור בזמן אמת עם <a href="https://github.com/arielmoatti/claude-code-vsc-statusline">claude-code-vsc-statusline</a>, והצילום למעלה הוא ממנה. בזמן ש-VS Code פתוח, השומר גם לוקח ממנה את שעת הסגירה ולא צריך לשאול את השרת.

---

חלק מ<a href="https://github.com/arielmoatti/claude-on-vscode">חבילת הכלים ל-Claude Code</a>. רישיון MIT.

</div>
