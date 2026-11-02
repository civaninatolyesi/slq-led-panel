/**
 * Donanım duman testi: derlenmiş uygulamayı Electron'da açar, verilen panele uygulamanın kendi BLE yolu
 * (Web Bluetooth) üzerinden bağlanır ve her özelliği bir kez dener. Panel cevaplarını (ST, parça onayı) denetler;
 * görsel doğrulama için her adımda panelde ne görülmesi gerektiğini yazar.
 *
 *   npx vite build && npx electron scripts/hwtest.cjs SLQ-B555F7
 *
 * Güvenlik: yalnızca C821/C822 kullanılır (uygulamada AE01 yolu yoktur). Reset, şifre ve panel tipi denenmez.
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const TARGET = process.argv.slice(2).find((a) => a.startsWith('SLQ-')) ?? 'SLQ-B555F7'

const STEPS = String.raw`
const { useStore, P, text, media, anim } = window.__slq
const s = () => useStore.getState()
const log = (...a) => console.log('[hw]', ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
async function step(name, expect, fn) {
  const t0 = performance.now()
  let ok = false, detail = ''
  try { const r = await fn(); ok = r === undefined || r === true || (r && r.ok); detail = r && r.detail ? r.detail : (typeof r === 'object' && r ? JSON.stringify(r) : '') }
  catch (e) { detail = String(e && e.message || e) }
  const ms = Math.round(performance.now() - t0)
  results.push({ name, ok, ms, detail })
  log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' (' + ms + ' ms) ' + detail + ' | panelde: ' + expect)
  await sleep(2500)
}
const p = () => s().panel
const gif = (id) => media.encodeGif(anim.presetFrames(anim.PRESETS.find((x) => x.id === id)))

await step('durum sorgusu', '-', async () => { const i = await p().queryInfo(); return { ok: !!i, detail: JSON.stringify(i) } })
await step('parlaklık 40', 'parlaklık düşer', () => p().send(P.brightness(40)))
await step('ekran kapat', 'ekran kararır', () => p().commandOk(P.power(false)))
await step('ekran aç', 'ekran geri gelir', () => p().commandOk(P.power(true)))
await step('yazı SLQ STUDIO sola kay', 'turuncu "SLQ STUDIO" sola kayar', () => { const e = text.encodeText('SLQ STUDIO', [255, 90, 0], 'narrow'); return p().sendText(e.data, { effect: P.Effect.LEFT, speed: 60 }) })
await step('Türkçe dar glifler (sabit)', '"ŞÜKRÜ ÇİĞ" ve sonra "ığüöçş" sayfa sayfa, aksanlar doğru', () => { const e = text.encodeText('ŞÜKRÜ ÇİĞ ığüöçş', [0, 255, 120], 'narrow'); return p().sendText(e.data, { effect: P.Effect.FIXED, speed: 40 }) })
await step('metin stili: lazer + gradyan 3', 'aynı yazı lazer efektiyle, mavi→mor→kırmızı', () => p().commandOk(P.textStyle({ effect: P.Effect.LASER, speed: 50, colorIndex: 3, rgb: [255, 0, 0], bgIndex: 0, bgRgb: [0, 0, 0], orientation: 0 })))
await step('gökkuşağı harfler + geniş sembol', 'her harf farklı renk, ♥ işareti 12px', () => { const e = text.encodeText('SELAM ♥', (i, n) => text.rainbow(i, n), 'narrow'); return p().sendText(e.data, { effect: P.Effect.LEFT, speed: 55 }) })
await step('GIF: atan kalp', 'kırmızı kalpler atar', () => p().sendGif(gif('heart')))
await step('GIF: gökkuşağı (büyük, ~30 parça)', 'akan gökkuşağı', () => p().sendGif(gif('rainbow')))
await step('GIF: bakan gözler', 'mavi gözler sağa sola bakar, göz kırpar', () => p().sendGif(gif('eyes')))
await step('saat stili 1', 'saat gösterilir (doğru saat)', () => p().commandOk(P.clock(1, new Date())))
await step('bisiklet sağ sinyal', 'sağ sinyal animasyonu', () => p().commandOk(P.bikeSignal(P.BikeSignal.RIGHT)))
await step('bisiklet hız 23.4', 'hız göstergesi', () => p().commandOk(P.bikeSpeed(23.4)))
await step('grafiti: çapraz çizgi + ayna', 'boş tuval, çapraz camgöbeği çizgi ve yatay aynası', async () => {
  if (!(await p().commandOk(P.graffiti(P.GraffitiMode.NEW)))) return false
  for (let i = 0; i < 12; i++) await p().send(P.pixel(i * 2, i, [0, 220, 255], P.PixelMode.MIRROR_H))
  return true
})
await step('grafitiden çık', 'önceki içerik döner', () => p().commandOk(P.graffiti(P.GraffitiMode.EXIT)))
await step('müzik ritmi 3 sn', 'ekolayzır çubukları oynar', async () => {
  for (let k = 0; k < 50; k++) { await p().sendLatest('rhythm', P.rhythm(k % 5 === 0 ? 1 : 0, Array.from({ length: 12 }, (_, b) => Math.round(8 + 8 * Math.sin(k / 3 + b / 2))))); await sleep(60) }
  return p().commandOk(P.rhythmOff())
})
await step('playlist: yazı + 2 GIF', 'panel 3 öğe arasında kendisi döner', () => {
  const e = text.encodeText('PLAYLIST', [255, 200, 0], 'narrow')
  return p().sendPlaylist([{ kind: 'text', data: e.data, opts: { effect: P.Effect.LEFT, speed: 60 } }, { kind: 'gif', data: gif('fire') }, { kind: 'gif', data: gif('hazard') }])
})
await sleep(8000)
await step('zamanlayıcı kapalı (00/00)', 'görünür etki yok, saat ayarlanır', () => p().commandOk(P.schedule(null, null, new Date())))
await step('parlaklık 60', '-', () => p().send(P.brightness(60)))
log('SONUC ' + results.filter((r) => r.ok).length + '/' + results.length + ' ' + JSON.stringify(results.filter((r) => !r.ok)))
`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 800, show: false, webPreferences: { preload: path.join(__dirname, '..', 'electron', 'preload.cjs'), backgroundThrottling: false } })
  win.webContents.on('console-message', (e) => e.message.startsWith('[hw]') && console.log(e.message.slice(5)))
  win.webContents.on('select-bluetooth-device', (event, devices, cb) => {
    event.preventDefault()
    const d = devices.find((x) => x.deviceName === TARGET)
    if (d) cb(d.deviceId)
  })
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await win.webContents.executeJavaScript(`localStorage.setItem('slqDebug','1'); localStorage.removeItem('slq-studio'); location.reload()`)
  await new Promise((r) => setTimeout(r, 2500))
  console.log(`hedef ${TARGET}: bağlanılıyor…`)
  const t0 = Date.now()
  await win.webContents.executeJavaScript(`window.__slq.useStore.getState().connectTo()`, true)
  const name = await win.webContents.executeJavaScript(`(window.__slq.useStore.getState().conn + ' ' + JSON.stringify(window.__slq.useStore.getState().lastDevice))`)
  console.log(`bağlantı: ${name} (${Date.now() - t0} ms)`)
  if (!name.startsWith('connected')) return app.quit()
  try {
    await win.webContents.executeJavaScript(`(async () => { ${STEPS} })()`)
  } catch (e) {
    console.log('HATA', e)
  }
  await win.webContents.executeJavaScript(`window.__slq.useStore.getState().disconnect()`)
  app.quit()
})
