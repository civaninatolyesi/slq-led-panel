# Değişiklik Günlüğü

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/), sürümleme [SemVer](https://semver.org/lang/tr/).

## [1.0.1] — 2026-11-02

İlk paketli sürüm. Uygulama kodu 1.0.0 ile aynıdır.

### Düzeltildi
- Sürüm paketleme iş akışı: etiket ile `package.json` aynı sürümdeyken masaüstü derlemesi duruyordu;
  Android derlemesi SDK lisans onayında takılıyordu. 1.0.0 etiketi bu yüzden paketsiz kaldı.

## [1.0.0] — 2026-11-02

İlk herkese açık sürüm: son kullanıcılar için SLQ Studio uygulaması. Bundan sonra depo ve uygulama aynı sürüm numarasını kullanır.

### Eklendi
- `app/`: SLQ Studio — Windows, Linux, macOS (Electron), Android (Capacitor) ve tarayıcıda (PWA) çalışan
  tek kod tabanlı kontrol uygulaması. Panelin bütün özellikleri: yazı (8 efekt, renk, gradyan, gökkuşağı,
  dikey), 17 hazır animasyon, resim/GIF yükleme, kare kare piksel animasyon stüdyosu, canlı çizim, müzik
  ritmi (mikrofon, dosya, Windows'ta sistem sesi), bisiklet (sinyal, elle/GPS hız), saat, zamanlayıcı,
  playlist, parlaklık/güç/döndürme, sıfırlama, geliştirici konsolu. Türkçe ve İngilizce, koyu ve açık tema.
- Protokolün TypeScript portu (`app/src/core/`) ve Python'la bayt bayt karşılaştıran testler
  (`tools/gen_test_vectors.py`, 32 test).
- Türkçe harfler için dar (6×12, TİP 3) glifler: Ç Ş Ğ Ü Ö İ ç ş ğ ü ö ı. Panelde doğrulandı.
- Donanım duman testi `app/scripts/hwtest.cjs`: SLQ-B555F7 üzerinde 20/20 adım başarılı.
- GitHub Actions: test, masaüstü/Android paketleri, GitHub Release ve Pages yayını.
- [Uygulama rehberi](docs/app.md), [uygulama doğrulama raporu](docs/verification/2026-11-02-app-report.md).
- Yayına hazırlık: MIT lisansı, CONTRIBUTING, SECURITY, issue/PR şablonları, `.gitattributes`.
- Türkçe dar gliflerin biçimi spesifikasyona eklendi ([5.1](docs/protocol/05-data-formats.md)).

## [0.2.0] — 2026-11-02

Protokol üretici uygulamasından çıkarıldı ve donanımda doğrulandı.

### Eklendi
- `slq` Python paketi: `protocol`, `text`, `media`, `ble` modülleri ve `Panel` sınıfı.
- `tools/slq_cli.py`: tarama, durum sorgusu, metin/GIF gönderme, parlaklık, saat, zamanlayıcı, ham komut.
- `tools/slq_test.py`: tarayıcı arayüzlü donanım doğrulama paketi (53 test).
- Protokol spesifikasyonu (`docs/protocol/`), geliştirici rehberi, tersine mühendislik notları.
- Doğrulama raporu ve ham kanıtlar (`docs/verification/2026-11-02-*`).
- Belgelenmemiş iki özellik bulundu: saat göstergesi (`0E`) ve otomatik aç/kapa zamanlayıcısı (`0F`).

### Değişti
- Komut çerçevesi `CMD SUB LEN PAYLOAD CRC16` olarak belirlendi. 0.1.0'daki `BC … 55` hipotezi yanlıştı.
- Yerleşik font glifleri `convertToStandardFormat` dönüşümüyle gönderiliyor. Ham tablo panelde bozuk görünüyor.
- Zamanlayıcı etkin bitinin anlamı uygulamadaki adlandırmanın tersi: `bit0 = 1` etkin.

### Kaldırıldı
- Kara kutu aşamasının araçları (`led-ekran.py`, `slq_probe.py`, `slq_dash.py`), deney planları ve logları.
  Tamamı proje dışında `LED-Ekran_arsiv_kara-kutu_2026-11-01.zip` olarak arşivlendi.

## [0.1.0] — 2026-11-01

Kara kutu aşaması: uygulama kodu olmadan BLE taramalarıyla protokol arandı.

### Bulunanlar (0.2.0'da da geçerli)
- GATT yapısı (C820 servisi; C821/C822/C823), MTU 517, üretici ID 0x4801.
- Cevaplardaki CRC-16/MODBUS (yüksek byte önce).

### Yanlış çıkanlar
- `BC CMD LEN … CRC 55` çerçevesi ve "S0/S1 durum makinesi" yorumları. Gözlenen `XX YY 01 00`
  cevaplarının hepsi aslında geçersiz komutlara verilen ret cevabıydı (ST=0).

[1.0.1]: https://github.com/civaninatolyesi/slq-led-panel/releases/tag/v1.0.1
[1.0.0]: https://github.com/civaninatolyesi/slq-led-panel/releases/tag/v1.0.0
