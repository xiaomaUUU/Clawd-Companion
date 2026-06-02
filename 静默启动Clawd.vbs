Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "D:\build\GitLocal\claude-code-companion"
shell.Run "cmd.exe /c npm run start", 0, False
