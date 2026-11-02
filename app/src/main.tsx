import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isElectron, isNative } from './ble/transport'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Donanım testi kancası (scripts/hwtest.cjs). Yalnızca localStorage.slqDebug = '1' iken açılır.
try {
  if (localStorage.getItem('slqDebug') === '1')
    void Promise.all([import('./state/store'), import('./core/protocol'), import('./core/text'), import('./core/media'), import('./core/animations')]).then(
      ([store, P, text, media, anim]) => Object.assign(window, { __slq: { useStore: store.useStore, P, text, media, anim } }),
    )
} catch {
  /* localStorage yok */
}

// Web sürümü (GitHub Pages) çevrimdışı çalışsın ve "uygulama olarak yüklenebilsin" diye.
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isElectron() && !isNative()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
