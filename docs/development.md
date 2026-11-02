# Geliştirici rehberi

Bu rehber Python referans istemcisini (`slq/`) ve donanım araçlarını anlatır.
SLQ Studio uygulamasının (`app/`) geliştirilmesi için: [uygulama rehberi](app.md#2-geliştiriciler-için).

## Kurulum

```bash
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

Gereksinimler: Python 3.11+, Bluetooth 4.2+ adaptör (Windows 10+, Linux BlueZ ya da macOS).
Komutlar proje kökünden çalıştırılır. Loglar `logs/` altına yazılır (depoya girmez).

**Panel görünmüyorsa:** telefondaki üretici uygulamasını kapat ya da telefonun Bluetooth'unu kapat.
Panel tek bağlantı kabul eder.

## Kütüphane

| Modül | Sorumluluk |
|---|---|
| `slq.protocol` | sabitler, `crc16`, `crc32c`, `frame()`, tüm komut kurucular, `parse_response()`, `chunks()` |
| `slq.text` | `encode_text()`: metni TİP 3/TİP 4 gliflere çevirir; `font_std()` dönüşümü |
| `slq.media` | `encode_gif()`: kareleri 48×12 GIF'e çevirir |
| `slq.ble` | `scan()`, `Panel` (bağlantı, yeniden bağlanma, komut, transfer), `EventLog` |

`protocol`, `text` ve `media` BLE'den bağımsızdır, yani saf fonksiyonlardır. Android tarafına taşınacak
mantığın tamamı bu üç modüldedir.

### Panel API'si

```python
async with Panel(addr, log=EventLog("benim"), on_tx=None, on_rx=None) as p:
    rs = await p.command(P.power(True))          # list[Response]; sessiz komutlarda boş
    r = await p.query_info()                     # Response | None
    t = await p.send_text("ABC", rgb=(0, 255, 0), mode="mixed", effect=P.Effect.LEFT, speed=60)
    t = await p.send_gif(encode_gif(frames, duration_ms=120))
    t = await p.send_playlist([gif1, gif2])      # TransferResult(ok, chunks, detail)
```

- `command()` yazar ve `wait` saniye boyunca gelen cevapları toplar. ST kontrolü çağırana aittir.
- `transfer()` [4. bölümdeki](protocol/04-transfers.md) akışı uygular. `force=True` "gönder" cevabını beklemez (yalnızca deney amaçlı).
- `on_tx` / `on_rx` kancaları arayüzlere trafik göstermek içindir (bkz. `tools/slq_test.py`).

## Komut satırı aracı

`tools/slq_cli.py`. Varsayılan adres geliştirme paneli (`--addr` ile değiştirilir). `-v` BLE trafiğini gösterir.

| Komut | Örnek |
|---|---|
| `scan` | `python tools/slq_cli.py scan` |
| `info` | sürüm/şifre/parlaklık |
| `brightness N` | `brightness 40` |
| `power on\|off`, `rotate on\|off` | |
| `text` | `text "MERHABA" --color ff8000 --effect LEFT --speed 60 --mode mixed` |
| `gif DOSYA` | 48×12 GIF'i olduğu gibi gönderir; diğer resim/animasyonları 48×12 GIF'e çevirir |
| `clock --style 0..3` | saat göstergesi |
| `schedule [--on HH:MM] [--off HH:MM]` | parametresiz çağrı zamanlayıcıyı kapatır |
| `playlist-clear` | fabrika animasyonlarına dön |
| `cmd HEX…` | `cmd 00 01 01 32`: C821'e ham komut, CRC otomatik |

## Doğrulama paketi

`tools/slq_test.py`: her özelliği panelde dener, gözlemci tarayıcıdan sonuç verir.

```bash
python tools/slq_test.py --list                 # testleri listele
python tools/slq_test.py                        # http://localhost:8766
python tools/slq_test.py --from metin_efekt_1   # belirli testten başla
```

- Klavye: `1` oldu, `2` olmadı, `3` kısmen, `r` tekrar gönder. Soldaki listeden teste atlanabilir.
- Sonuçlar `logs/test_results.jsonl` dosyasına eklenir; yeniden başlatınca önceki cevaplar listede görünür.
- "NEGATİF" testler desteklenmeyen özellikleri belgeler. Yeni bir firmware'de bunlar çalışırsa spesifikasyon güncellenmelidir.
- Bir doğrulama turundan sonra `logs/test_results.jsonl` ve oturum logunu `docs/verification/` altına tarihli olarak kopyala, bir rapor yaz.

### Yeni test ekleme

```python
@test("benim_testim", "Kısa başlık (CMD)", "Panelde ne görülmeli", describe=True)
async def _(c):                 # c: slq.Panel
    await c.command(P.brightness(50))
```

`describe=True` olan testlerde arayüz not girilmesini ister. `after=` cevaptan sonra çalışacak
geri alma fonksiyonudur (ör. zamanlayıcıyı temizlemek).

## Yeni komut ekleme

1. Komutu APK'da bul (`docs/reverse-engineering.md`, sınıf haritası).
2. `slq/protocol.py`'ye kurucu fonksiyon ekle. Doğrulanmamış alanları docstring'de belirt.
3. `tools/slq_test.py`'ye test ekle ve panelde çalıştır.
4. `docs/protocol/03-commands.md`'ye satır ve bölüm ekle; durumu (Doğrulandı / APK / Açık) yaz.
5. Aynı kurucuyu `app/src/core/protocol.ts`'ye ekle. `tools/gen_test_vectors.py`'ye bir vektör ekle,
   `python tools/gen_test_vectors.py` ile `app/src/core/vectors.json`'ı yenile ve `cd app && npm test` çalıştır.
6. `CHANGELOG.md`'yi güncelle.

## Güvenlik kuralları

| Kural | Neden |
|---|---|
| AE01'e asla yazma | JieLi OTA kanalı. Yanlış veri paneli kalıcı olarak bozabilir |
| `52` (şifre) ve `57` (panel tipi) yalnızca yedek panelde | panel kilitlenebilir ya da yanlış yapılandırılabilir |
| Zamanlayıcıyı kapatırken EN = `00` | `01` "etkin, gün yok" demektir |
| Deneyleri geliştirme panelinde yap (`SLQ-B555F7`) | ikinci panel (`SLQ-BA3FE9`) açık onay olmadan kullanılmaz |

## Android notları

Android desteği SLQ Studio'da (`app/src/ble/native.ts`, Capacitor + `@capacitor-community/bluetooth-le`) uygulandı.
Başka bir Android istemcisi yazacaklar için kurallar:

- `BluetoothGatt.writeCharacteristic` sırayla çağrılmalıdır. Her yazmanın `onCharacteristicWrite` geri çağrısı beklenmeden yenisi yazılmamalı (SLQ Studio'da `Panel.exclusive()`).
- C823 için CCCD (`0x2902`) değerine `ENABLE_NOTIFICATION_VALUE` yazılmalı.
- MTU istenmeli (üretici uygulaması 472, eklenti 512). Parça boyutu `min(446, MTU − 26)`; MTU ≤ 23 ise 7 bayt.
- Metin için `mode="mixed"` mantığı ve `font12.json` tablosu doğrudan taşınabilir. TİP 4 glifleri `Canvas` ile 12×12 çizilir.
