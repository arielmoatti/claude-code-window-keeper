# Register (or re-register) the Claude-Window-Keeper scheduled task: keeper.vbs from this folder,
# every 10 minutes, for the logged-on user, no elevation.
# Run: powershell -ExecutionPolicy Bypass -File register-task.ps1
$ErrorActionPreference = 'Stop'
$name = 'Claude-Window-Keeper'
$vbs = Join-Path $PSScriptRoot 'keeper.vbs'
if (-not (Test-Path $vbs)) { throw "keeper.vbs not found next to this script: $vbs" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"{0}"' -f $vbs)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description ('Keeps the Claude subscription 5h usage windows chained. Code: {0}' -f $PSScriptRoot) -Force | Out-Null

$t = Get-ScheduledTask -TaskName $name
"{0}: {1}, every {2}" -f $name, $t.State, $t.Triggers[0].Repetition.Interval
