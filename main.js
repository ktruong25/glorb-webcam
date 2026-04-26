const { app, BrowserWindow, Tray, nativeImage, ipcMain, globalShortcut, Notification, screen, session } = require('electron')
const path = require('path')
const { execFile } = require('child_process')
const net = require('net')
const fs = require('fs')
const Store = require('electron-store')
const store = new Store()

const SND = {
  chime: '/System/Library/Sounds/Glass.aiff',
  note1: '/System/Library/Sounds/Tink.aiff',
  note2: '/System/Library/Sounds/Pop.aiff',
  note3: '/System/Library/Sounds/Morse.aiff',
  note4: '/System/Library/Sounds/Blow.aiff',
  note5: '/System/Library/Sounds/Sosumi.aiff'
}

function playSound (filePath) {
  execFile('afplay', [filePath], { timeout: 10000 }, () => {})
}

function playNotes (count) {
  const sounds = [SND.note1, SND.note2, SND.note3, SND.note4, SND.note5].slice(0, count)
  sounds.forEach((s, i) => {
    trackTimeout(() => playSound(s), i * 300)
  })
}

let tray = null
let win = null
let onboardingWin = null

const SOCK_PATH = '/tmp/glorb-ipc.sock'

let driftCount = 0
const escalationTimers = []
let overlayWin = null

function clearAllTimers () {
  while (escalationTimers.length) {
    const ref = escalationTimers.pop()
    if (ref && ref._isInterval) clearInterval(ref)
    else clearTimeout(ref)
  }
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close()
    overlayWin = null
  }
}

function trackTimeout (fn, ms) {
  const id = setTimeout(fn, ms)
  escalationTimers.push(id)
  return id
}

function trackInterval (fn, ms) {
  const id = setInterval(fn, ms)
  id._isInterval = true
  escalationTimers.push(id)
  return id
}

function runPath (pathId) {
  switch (pathId) {
    case 'weak-regular':   return runWeakRegular()
    case 'weak-adhd':      return runWeakADHD()
    case 'strong-regular': return runStrongRegular()
    case 'strong-adhd':    return runStrongADHD()
    default:
      console.warn('[intervention] unknown pathId:', pathId)
  }
}

function weakTerminate (message) {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    win.webContents.send('intervention-terminate', { message })
  }
}

function runWeakRegular () {
  trackTimeout(() => {
    new Notification({ title: 'Glorb', body: 'Stay focused!' }).show()
    playSound(SND.chime)

    let pingCount = 1

    const interval = trackInterval(() => {
      pingCount++
      if (pingCount === 2) {
        playSound(SND.chime)
        trackTimeout(() => playSound(SND.chime), 400)
      } else if (pingCount === 3) {
        playSound(SND.chime)
        trackTimeout(() => playSound(SND.chime), 400)
        trackTimeout(() => playSound(SND.chime), 800)
        new Notification({ title: 'Glorb', body: 'Last reminder — Stay focused!' }).show()
        clearInterval(interval)
        const idx = escalationTimers.indexOf(interval)
        if (idx !== -1) escalationTimers.splice(idx, 1)
        trackTimeout(() => weakTerminate('Ready to continue focusing?'), 10000)
      }
    }, 10000)
  }, 30000)
}

function runWeakADHD () {
  trackTimeout(() => {
    new Notification({ title: 'Glorb', body: 'Stay focused!' }).show()
    playNotes(1)

    let pingCount = 1

    const interval = trackInterval(() => {
      pingCount++
      if (pingCount <= 5) {
        playNotes(pingCount)
        if (pingCount === 5) {
          clearInterval(interval)
          const idx = escalationTimers.indexOf(interval)
          if (idx !== -1) escalationTimers.splice(idx, 1)
          const chimeIntervalMs = 600
          const chimeCount = Math.floor(10000 / chimeIntervalMs)
          for (let i = 0; i < chimeCount; i++) {
            trackTimeout(() => playSound(SND.note1), i * chimeIntervalMs)
          }
          trackTimeout(() => weakTerminate('You lost focus.'), 10000)
        }
      }
    }, 5000)
  }, 10000)
}

function createOverlayWindow (htmlFile, durationMs) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close()
  }
  overlayWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    show: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  overlayWin.loadFile(htmlFile)
  overlayWin.on('closed', () => { overlayWin = null })
  if (durationMs) {
    trackTimeout(() => {
      if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close()
    }, durationMs)
  }
  return overlayWin
}

function fadeAudioOver30s () {
  const steps = 10
  const stepMs = 3000
  for (let i = 1; i <= steps; i++) {
    const targetVol = Math.max(0, 100 - i * 10)
    trackTimeout(() => {
      execFile('osascript', ['-e', `set volume output volume ${targetVol}`], () => {})
    }, i * stepMs)
  }
}

function runStrongRegular () {
  trackTimeout(() => {
    new Notification({ title: 'Glorb', body: 'Stay focused!' }).show()
    playSound(SND.chime)

    let pingCount = 1

    const interval = trackInterval(() => {
      pingCount++
      if (pingCount === 2) {
        playSound(SND.chime)
        trackTimeout(() => playSound(SND.chime), 400)
      } else if (pingCount === 3) {
        playSound(SND.chime)
        trackTimeout(() => playSound(SND.chime), 400)
        trackTimeout(() => playSound(SND.chime), 800)
        new Notification({ title: 'Glorb', body: 'Last reminder — Stay focused!' }).show()
        clearInterval(interval)
        const idx = escalationTimers.indexOf(interval)
        if (idx !== -1) escalationTimers.splice(idx, 1)

        trackTimeout(() => {
          createOverlayWindow('flash.html', 2000)
          trackTimeout(() => {
            fadeAudioOver30s()
            trackTimeout(() => {
              createOverlayWindow('vignette.html', 60000)
              trackTimeout(() => {
                createOverlayWindow('terminate.html', null)
              }, 60000)
            }, 500)
          }, 2000)
        }, 1000)
      }
    }, 10000)
  }, 15000)
}

function runStrongADHD () {
  trackTimeout(() => {
    new Notification({ title: 'Glorb', body: 'Stay focused!' }).show()
    playNotes(1)

    let pingCount = 1

    const interval = trackInterval(() => {
      pingCount++
      if (pingCount <= 5) {
        playNotes(pingCount)
        if (pingCount === 5) {
          clearInterval(interval)
          const idx = escalationTimers.indexOf(interval)
          if (idx !== -1) escalationTimers.splice(idx, 1)

          createOverlayWindow('flash.html', 5000)
          trackTimeout(() => {
            fadeAudioOver30s()
            trackTimeout(() => {
              createOverlayWindow('vignette.html', 60000)
              trackTimeout(() => {
                createOverlayWindow('terminate.html', null)
              }, 60000)
            }, 500)
          }, 5000)
        }
      }
    }, 5000)
  }, 10000)
}

function createWindow () {
  win = new BrowserWindow({
    width: 286,
    height: 468,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('renderer.html')

  win.on('blur', () => {
    win.hide()
  })
}

function createTray () {
  const trayIcon = nativeImage
    .createFromPath(path.join(__dirname, 'glorb_icon.png'))
    .resize({ width: 18, height: 18 })
  trayIcon.setTemplateImage(true)

  tray = new Tray(trayIcon)

  tray.on('click', () => {
    if (onboardingWin && !onboardingWin.isDestroyed()) return

    if (win.isVisible()) {
      win.hide()
    } else {
      const bounds = tray.getBounds()
      win.setPosition(
        Math.round(bounds.x + bounds.width / 2 - 143),
        Math.round(bounds.y + bounds.height)
      )
      win.show()
      win.focus()
    }
  })
}

function createOnboardingWindow () {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  onboardingWin = new BrowserWindow({
    width: Math.round(sw * 0.92),
    height: Math.round(sh * 0.92),
    show: true,
    frame: true,
    resizable: true,
    center: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  onboardingWin.loadFile('onboarding.html')

  onboardingWin.on('closed', () => {
    onboardingWin = null
  })
}

function startSocketServer () {
  try { fs.unlinkSync(SOCK_PATH) } catch (_) {}

  const server = net.createServer((socket) => {
    let buf = ''
    socket.on('data', (chunk) => {
      buf += chunk.toString()
      if (buf.includes('\n')) {
        const cmd = buf.trim()
        if (cmd === 'drift') {
          driftCount++
          const strength = store.get('strength', 'weak')
          const hasADHD = store.get('hasADHD', false)
          runPath(`${strength === 'strong' ? 'strong' : 'weak'}-${hasADHD ? 'adhd' : 'regular'}`)
          socket.write('ok\n')
        } else if (cmd === 'refocus') {
          if (driftCount > 0) {
            new Notification({ title: 'Glorb', body: 'Focus regained.' }).show()
          }
          driftCount = 0
          clearAllTimers()
          socket.write('ok\n')
        } else {
          socket.write(`unknown command: ${cmd}\n`)
        }
        socket.end()
      }
    })
    socket.on('error', () => {})
  })

  server.listen(SOCK_PATH, () => {
    console.log('[glorb] CLI socket listening at', SOCK_PATH)
  })

  server.on('error', (err) => {
    console.warn('[glorb] socket server error:', err.message)
  })

  return server
}

app.dock.hide()
app.setActivationPolicy('accessory')

app.whenReady().then(async () => {
  // Allow camera access for webcam drift detection
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media')
  })

  createWindow()
  createTray()
  startSocketServer()

  globalShortcut.register('Command+Q', () => {
    app.quit()
  })

  const onboardingComplete = store.get('onboardingComplete', false)
  if (!onboardingComplete) {
    createOnboardingWindow()
  }
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})

app.on('before-quit', () => {
  try { fs.unlinkSync(SOCK_PATH) } catch (_) {}
})

ipcMain.handle('quit-app', () => {
  app.quit()
})

ipcMain.handle('resize-window', (event, { width, height }) => {
  win.setSize(Math.round(width), Math.round(height))
  const bounds = tray.getBounds()
  win.setPosition(
    Math.round(bounds.x + bounds.width / 2 - width / 2),
    Math.round(bounds.y + bounds.height)
  )
})

ipcMain.handle('store-get', (event, key, defaultVal) => store.get(key, defaultVal))
ipcMain.handle('store-set', (event, key, value) => { store.set(key, value) })

ipcMain.handle('notify', (event, { title, body }) => {
  new Notification({ title, body }).show()
})

ipcMain.handle('open-onboarding', () => {
  store.set('onboardingComplete', false)
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.focus()
    return
  }
  createOnboardingWindow()
})

ipcMain.handle('close-overlay', () => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.close()
    overlayWin = null
  }
})

ipcMain.handle('close-onboarding', () => {
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    onboardingWin.close()
  }
  if (win && !win.isDestroyed()) {
    win.webContents.send('onboarding-complete')
  }
})

ipcMain.handle('drift-detected', () => {
  driftCount++
  const strength = store.get('strength', 'weak')
  const hasADHD = store.get('hasADHD', false)
  runPath(`${strength === 'strong' ? 'strong' : 'weak'}-${hasADHD ? 'adhd' : 'regular'}`)
})

ipcMain.handle('refocus-detected', () => {
  if (driftCount > 0) {
    new Notification({ title: 'Glorb', body: 'Focus regained.' }).show()
  }
  driftCount = 0
  clearAllTimers()
})
