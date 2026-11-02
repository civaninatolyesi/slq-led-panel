# Tersine mühendislik notları

Protokol bilgisinin nereden geldiğini, nasıl yeniden üretileceğini ve üretici uygulaması ile
firmware'in nerede ayrıştığını belgeler.

## Kaynak

| | |
|---|---|
| Dosya | `vendor/Sanluqi Display-v1.0.8-c9-260711-china-release.apk` (depoya dahil değil) |
| SHA-256 | `450526bc8719c9eea2cea53cc2266c0051799e120138fbd3dbfd6e9b19373c6e` |
| Paket | `com.led.ledpanel`, versionName 1.0.8, versionCode 9, minSdk 24 |
| Tür | Native Java/Kotlin (Flutter değil), 3 DEX |
| Kaynak | Üretici tarafından kullanıcıya gönderildi |

APK ayrıca JieLi OTA kütüphanelerini (`libjl_ota_auth.so` vb.) ve bir firmware dosyası içerir:
`assets/ota/GL202605N003_HW_12X48_0104.ufw`. Bu projede OTA kullanılmaz.

## Yeniden üretme

```bash
# jadx 1.5.1 (https://github.com/skylot/jadx/releases), Java 17+
export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot"
jadx -d apk_src --show-bad-code -j 8 "vendor/Sanluqi Display-v1.0.8-c9-260711-china-release.apk"
```

Decompile çıktısı depoya konmaz. Font tablosu `Text12.java` içindeki `get_X()` metotlarından
bir betikle çıkarıldı. Sonuç `slq/data/font12.json` (91 karakter × 12 bayt).

## Sınıf haritası

| Sınıf (`com.led.…`) | İçerik | Spesifikasyondaki yeri |
|---|---|---|
| `ledpanel.ble.BleManager` | UUID'ler, MTU 472, `write()` = CRC16 ekle + C821, `writeBy2()` = C822 | [01](protocol/01-transport.md) |
| `ledpanel.ble.BleSendManager` | tüm kısa komutların bayt düzenleri | [03](protocol/03-commands.md) |
| `ledpanel.ble.TextAgreement` | metin transfer akışı, parça biçimi, cevap kalıpları | [04.2](protocol/04-transfers.md#42-metin) |
| `ledpanel.ble.ImageAgreement` | resim transfer akışı, kumanda (YK) varyantı | [04.3](protocol/04-transfers.md#43-resim-gif) |
| `ledpanel.ble.PlayListAgreement` | playlist akışı | [04.4](protocol/04-transfers.md#44-playlist) |
| `ledpanel.ble.BleConfig` | advertising filtreleme ve alan çözümü | [01.1](protocol/01-transport.md#11-keşif-advertising) |
| `base.utils.CrcUtils` / `blelib.ble.utils.CrcUtils` | CRC16 / CRC32C (Guava) | [02](protocol/02-framing.md) |
| `ledpanel.core.data.Text12` | glif kodlama, font tablosu, `convertToStandardFormat` | [05.1](protocol/05-data-formats.md#51-metin-kodlama) |
| `ledpanel.ledcanvasui.*Activity` | hangi ekranın hangi komutu hangi parametreyle gönderdiği | — |
| `ledpanel.ledcanvasui.ClockActivity` | zamanlayıcı (`setClockTime`), `buildEnableByte` | [03](protocol/03-commands.md#zamanlayıcı-0f-01) |
| `ledpanel.view.rhythm.RhythmDataUitls` | ritim bantları (12 × 0..16) | [03](protocol/03-commands.md#müzik-ritmi-0d) |

## Uygulama ile firmware arasındaki farklar

Bu farklar yalnızca donanım testinde ortaya çıktı. Kodu okumak tek başına yeterli değildi.

| Konu | Uygulamanın yaptığı | Firmware 1.0.6'nın davranışı |
|---|---|---|
| Font glifleri | `getCharDataByFont` ham tabloyu gönderiyor | ham tablo bozuk görünür; `convertToStandardFormat` gerekli |
| Zamanlayıcı etkin biti | `buildEnableByte`: etkin için bit0 = 0 gibi okunuyor | bit0 = 1 etkin (`FE` çalışmadı, `FF` çalıştı) |
| Resim efekti | `00 04 00 01 EE` | ST=0 ile reddedilir; GIF'e efekt uygulanmaz |
| Döndürme/hizalama | `00 06`, `00 07` (2 bayt LEN) | ST=0; çalışan döndürme `51 01` |
| Hazır animasyon | `05 03 00 04 …` | ST=0 |
| Kumanda yuvaları | `18 02`, `09 01`, `80 01` | sessiz ve etkisiz; bu modelde yok |
| Metin efekti numaraları | metin ekranı butonları: sabit, sol, sağ, perde, kar, lazer, yukarı, aşağı | firmware: 0 sabit, 1 sol, 2 sağ, 3 yukarı, 4 aşağı, 5–6 sayfa, 7 lazer |
| Kumanda yuva numarası | yükleme yuva = liste sırası + 1; oynatma id = 4.. | (özellik yok) |
| Saat göstergesi `0E` | hiçbir ekranda kullanılmıyor | çalışıyor, 4 tasarım |

Muhtemel açıklama: uygulama birden fazla panel kuşağını destekliyor (`isOld`, `isLedSinger`, cihaz tipi alanları).
Bazı kod yolları bu panelin kuşağına ait değil.

## Tarihçe

1. **Kara kutu aşaması (2026-11-01):** Uygulama kodu olmadan BLE taramaları yapıldı. GATT yapısı ve CRC bulundu
   ama hiçbir geçerli komut keşfedilemedi. `BC … 55` çerçeve hipotezi yanlış çıktı. Gözlenen bütün
   `XX YY 01 00` cevapları ret cevaplarıydı. Çıktılar proje dışında arşivlendi.
2. **APK analizi (2026-11-02):** Komut seti ve akışlar decompile edilmiş koddan çıkarıldı.
3. **Donanım doğrulaması (2026-11-02):** Her özellik panelde denendi.
   [Rapor](verification/2026-11-02-report.md).
