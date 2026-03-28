import { app, BrowserWindow, session } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc/handlers'

app.whenReady().then(() => {
  // Set app user model id for Windows taskbar
  electronApp.setAppUserModelId('com.soundpilot.app')

  // Grant microphone permission automatically for the renderer.
  // SoundPilot is a local audio analysis tool — mic access is its core function.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // On macOS we also need to handle permission check
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media'
  })

  // Register all IPC handlers before creating the window
  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when clicking dock icon with no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Dev tools shortcut handling
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
})

app.on('window-all-closed', () => {
  // On macOS, apps stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
