# Proje notları (kodlama asistanları için)

SLQ 48×12 RGB LED panelinin BLE protokolü (`slq/`, Python referans istemcisi, `docs/protocol/`) ve
çok platformlu SLQ Studio uygulaması (`app/`, React + Vite + Electron + Capacitor).

- Dokümantasyon ve kod yorumları Türkçedir. Yeni metinleri de Türkçe yaz.
- Belge dizini: [docs/README.md](docs/README.md). Uygulama: [docs/app.md](docs/app.md).
- **Yeni hazır animasyon eklerken önce [docs/animations.md](docs/animations.md) dosyasını oku.**
  Panel kuralları, API, şablonlar, önizleme aracı (`PRESET=<id> npm run preview:preset`) ve kontrol listesi orada.
- Uygulama komutları `app/` içinde çalışır: `npm run typecheck`, `npm test`, `npm run dev`.
- Animasyonlar kodla üretilir. Telifli görsel, logo ya da karakter kopyalanmaz.
- Mevcut bir animasyonu yeniden düzenlerken çıktısı bayt bayt aynı kalmalı. Değişirse paneldeki GIF CRC'si değişir.
- Panel güvenliği ve donanım testleri: [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md).
