/**
 * SLQ Studio masaüstü kabuğu (Windows / Linux / macOS).
 * Arayüz Web Bluetooth kullanır; Electron'da cihaz seçici olmadığı için `select-bluetooth-device`
 * olayını yakalayıp listeyi arayüze iletiriz, kullanıcı uygulamanın kendi penceresinden seçer.
 */
const { app, BrowserWindow, ipcMain, shell, session, desktopCapturer } = require('electron')
const path = require('node:path')

// Linux'ta Web Bluetooth (BlueZ) deneysel özellik bayrağı arkasında
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-experimental-web-platform-features')

let win = null
let pendingSelect = null // select-bluetooth-device geri çağrısı
let autoSelectId = null
let autoTimer = null

function finishSelect(id) {
  if (!pendingSelect) return
  const cb = pendingSelect
  pendingSelect = null
  autoSelectId = null
  clearTimeout(autoTimer)
  cb(id)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#07080c',
    title: 'SLQ Studio',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win.show())

  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    pendingSelect = callback
    if (autoSelectId && devices.some((d) => d.deviceId === autoSelectId)) {
      finishSelect(autoSelectId)
      return
    }
    win.webContents.send('bt:devices', devices)
  })

  // Dış bağlantılar sistem tarayıcısında açılır
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.SLQ_DEV_URL) win.loadURL(process.env.SLQ_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.on('bt:select', (_e, id) => finishSelect(id || ''))

ipcMain.handle('bt:auto-select', async (_e, id) => {
  autoSelectId = id
  clearTimeout(autoTimer)
  autoTimer = setTimeout(() => finishSelect(''), 15000)
  // requestDevice "kullanıcı hareketi" ister; çağrıyı kullanıcı etkileşimi olarak çalıştırırız.
  await win.webContents.executeJavaScript('window.__slqGestureRequest && window.__slqGestureRequest()', true)
})

ipcMain.on('open-external', (_e, url) => {
  if (/^https?:/.test(url)) shell.openExternal(url)
})

app.whenReady().then(() => {
  const ses = session.defaultSession
  // Mikrofon (müzik ritmi) ve Bluetooth izinleri
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(['media', 'bluetooth', 'geolocation', 'display-capture'].includes(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => ['media', 'bluetooth', 'geolocation'].includes(permission))
  // "Bilgisayar sesi" kaynağı: Windows'ta sistem sesi (loopback)
  ses.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => cb({ video: sources[0], audio: 'loopback' }))
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
