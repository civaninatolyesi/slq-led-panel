# SLQ LED Panel — BLE Protokolü ve İstemci Kütüphanesi

Sanluqi (SLQ) marka 48×12 RGB LED kask panellerinin Bluetooth Low Energy protokolünün açık
spesifikasyonu, Python referans istemcisi ve donanım doğrulama araçları.

Amaç: üreticinin "Sanluqi Display" uygulamasına bağlı kalmadan panelleri kendi Android
uygulamamızdan kontrol etmek. Bu depo o uygulamanın protokol katmanı için tek doğruluk kaynağıdır.

| | |
|---|---|
| **Durum** | Protokol çözüldü ve donanımda doğrulandı (2026-11-02) |
| **Hedef donanım** | SLQ-xxxxxx paneller, 48×12 RGB, firmware 1.0.6 (JieLi BLE SoC) |
| **Referans istemci** | Python 3.11+, [bleak](https://github.com/hbldh/bleak), Pillow |
| **Kaynak** | Üretici uygulaması v1.0.8'in tersine mühendisliği + donanım testleri |

## Desteklenen özellikler

| Özellik | Durum | Özellik | Durum |
|---|---|---|---|
| Parlaklık, ekran aç/kapa, 180° döndürme | ✅ | Müzik ritmi (5 ekolayzır stili) | ✅ |
| Metin (Türkçe dahil), 8 efekt, hız, renk, gradyan, dikey yazı | ✅ | Bisiklet modu (sinyal, hız göstergesi) | ✅ |
| Statik ve animasyonlu GIF (48×12) | ✅ | Playlist (panel kendi döndürür) | ✅ |
| Canlı piksel çizimi, ayna, silgi | ✅ | Saat göstergesi (4 tasarım) | ✅ |
| Otomatik aç/kapa zamanlayıcısı | ✅ | Durum sorgusu (sürüm, şifre, parlaklık) | ✅ |
| Resim efektleri | ❌ bu firmware'de yok | Kumanda yuvaları | ❌ bu modelde yok |

Ayrıntılar ve kanıtlar: [doğrulama raporu](docs/verification/2026-11-02-report.md).

## Hızlı başlangıç

```bash
pip install -r requirements.txt

python tools/slq_cli.py scan                               # yakındaki panelleri bul
python tools/slq_cli.py --addr 71:85:ED:B5:55:F7 info      # bağlan, durum sorgula
python tools/slq_cli.py text "MERHABA" --color 00ff00 --effect LEFT
python tools/slq_cli.py gif animasyon.gif
```

> Panel aynı anda yalnızca **bir** BLE bağlantısı kabul eder. Telefondaki üretici uygulaması bağlıysa
> bilgisayar paneli göremez.

Kütüphane olarak:

```python
import asyncio
from slq import Panel, encode_gif, solid, protocol as P

async def main():
    async with Panel("71:85:ED:B5:55:F7") as panel:
        await panel.command(P.brightness(60))
        await panel.send_text("SELAM", rgb=(255, 128, 0), effect=P.Effect.LEFT)
        await panel.send_gif(encode_gif([solid((0, 0, 255))]))

asyncio.run(main())
```

## Depo yapısı

```
slq/                    Python referans istemcisi
  protocol.py           sabitler, CRC'ler, çerçeve ve komut kurucular, cevap çözücü
  text.py               metin -> glif kodlama (yerleşik font + bitmap)
  media.py              48x12 GIF üretimi
  ble.py                bağlantı, notify kuyruğu, transfer akışları (Panel sınıfı)
  data/font12.json      üretici uygulamasından çıkarılan 6x12 font tablosu
tools/
  slq_cli.py            komut satırı aracı
  slq_test.py           tarayıcı arayüzlü donanım doğrulama paketi
docs/                   spesifikasyon, rehberler, doğrulama raporları
vendor/                 üretici APK'sı (depoya dahil edilmez)
```

## Dokümantasyon

| Belge | İçerik |
|---|---|
| [docs/README.md](docs/README.md) | Belge dizini ve okuma sırası |
| [Protokol spesifikasyonu](docs/protocol/01-transport.md) | Taşıma, çerçeveleme, komutlar, transferler, veri biçimleri |
| [Komut referansı](docs/protocol/03-commands.md) | Her komutun bayt düzeni, cevabı ve doğrulama durumu |
| [Geliştirici rehberi](docs/development.md) | Kurulum, kütüphane API'si, araçlar, yeni komut ekleme |
| [Tersine mühendislik notları](docs/reverse-engineering.md) | Kaynak sınıf haritası, uygulama ile firmware arasındaki farklar |
| [CHANGELOG](CHANGELOG.md) | Sürüm geçmişi |

## Güvenlik

- **AE01/AE02 (JieLi OTA) karakteristiklerine yazılmaz.** Kütüphane bu yolu bilerek sunmaz; yanlış veri paneli kalıcı olarak bozabilir.
- `52` (şifre koy) ve `57` (sol/sağ panel tipi) komutları denenmedi. Paneli kilitleyebilir ya da yanlış yapılandırabilir.
- `50` (reset) panel ayarlarını sıfırlar.

## Yasal not

Bu çalışma, sahibi olunan cihazlarla birlikte çalışabilirlik (interoperability) amacıyla yapılmıştır.
Üretici APK'sı ve ondan türetilen kaynak kod depoda dağıtılmaz; yalnızca protokol bilgisi ve
font tablosu (işlevsel veri) belgelenmiştir.
