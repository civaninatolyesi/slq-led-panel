# Değişiklik Günlüğü

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/), sürümleme [SemVer](https://semver.org/lang/tr/).

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
