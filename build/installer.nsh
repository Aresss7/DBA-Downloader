; Custom NSIS installer script for DBA Downloader
; Ensures the install directory always includes the "DBA Downloader" subfolder

; preInit runs before .onInit — clears cached registry path so default is used
!macro preInit
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation ""
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation ""
!macroend

; customInit runs inside .onInit — fixes the displayed default path
!macro customInit
  ; "DBA Downloader" = 14 characters. Check if path already ends with it.
  StrCpy $R0 "$INSTDIR" "" -14
  StrCmp $R0 "DBA Downloader" skipAppend
    StrCpy $INSTDIR "$INSTDIR\DBA Downloader"
  skipAppend:
!macroend

; customInstall runs BEFORE files are extracted — safety net after Browse
!macro customInstall
  StrCpy $R0 "$INSTDIR" "" -14
  StrCmp $R0 "DBA Downloader" skipAppend2
    StrCpy $INSTDIR "$INSTDIR\DBA Downloader"
  skipAppend2:
  CreateDirectory "$INSTDIR"
!macroend
