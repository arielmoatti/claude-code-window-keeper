' Run keeper.js once, fully hidden (no console window), then exit.
' The Claude-Window-Keeper scheduled task runs this every 10 minutes.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "node """ & dir & "\keeper.js""", 0, False
