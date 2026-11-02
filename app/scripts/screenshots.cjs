/**
 * Her sayfanın ekran görüntüsünü alır (README ve tasarım kontrolü için).
 *   npx vite build && npx electron scripts/screenshots.cjs <çıktı-klasörü> [genişlik] [yükseklik] [tema] [dil]
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const [out = 'screenshots', w = '1280', h = '840', theme = 'dark', lang = 'tr'] = process.argv.slice(2).filter((a) => !a.endsWith('.cjs') && a !== '.')
const PAGES = ['home', 'text', 'media', 'draw', 'music', 'bike', 'clock', 'playlist', 'settings']

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true })
  const win = new BrowserWindow({ width: +w, height: +h, show: false, paintWhenInitiallyHidden: true, webPreferences: { backgroundThrottling: false, preload: path.join(__dirname, '..', 'electron', 'preload.cjs') } })
  win.webContents.on('console-message', (e) => e.level !== 'info' && e.level !== 'debug' && console.log('[renderer]', e.level, e.message))
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await win.webContents.executeJavaScript(
    `localStorage.setItem('slq-studio', JSON.stringify({state:{lang:'${lang}',theme:'${theme}',lastDevice:null,playlist:[],brightness:60,rotated:false},version:0})); location.reload()`,
  )
  await new Promise((r) => setTimeout(r, 1500))
  for (const p of PAGES) {
    await win.webContents.executeJavaScript(`location.hash='${p}'`)
    await new Promise((r) => setTimeout(r, 1200))
    win.webContents.invalidate()
    await new Promise((r) => setTimeout(r, 300))
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(out, `${p}-${w}.png`), img.toPNG())
  }
  app.quit()
})
