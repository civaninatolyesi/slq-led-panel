# 1. Taşıma katmanı

## 1.1 Keşif (advertising)

| Alan | Değer | Kaynak |
|---|---|---|
| Yerel ad | `SLQ-` + MAC adresinin son 3 baytı (ör. `SLQ-B555F7`) | Doğrulandı |
| Üretici ID | `0x4801` | Doğrulandı |
| Üretici verisi imzası | ilk 3 bayt `57 00 01` | APK, Doğrulandı |

Üretici uygulaması AD yapısında `FF 01 48 57 00 01` dizisini arar (`BleConfig.matchProduct`).
Bu dizi, AD tipi `0xFF`, little-endian üretici ID `01 48` ve imza `57 00 01`'den oluşur.

### Üretici verisi düzeni

İndeksler, üretici ID'si çıkarılmış veriye göredir. Bleak'te `manufacturer_data[0x4801]` budur.

| İndeks | Örnek | Anlam | Kaynak |
|---|---|---|---|
| 0–2 | `57 00 01` | ürün imzası | APK |
| 4 | `0c` | 12. Panel yüksekliği olabilir | Açık |
| 6 | `30` | 48. Panel genişliği olabilir | Açık |
| 8–9 | `01 06` | firmware sürümü; uygulama `1.0.<bayt9>` olarak gösterir | APK, Doğrulandı (1.0.6) |
| 12 | `00` | `isLedSinger` | APK |
| 13 | `01` | cihaz tipi | APK |
| 14 | `00` | `isOld` (eski panel) | APK |
| 15 | `00` | sol/sağ panel: 0 tek, 1 sol, 2 sağ | APK |

Örnek (SLQ-B555F7): `57 00 01 00 0c 00 30 03 01 06 00 01 00 01 00 00 00 00`

## 1.2 GATT

| Servis / karakteristik | Handle | Özellik | Kullanım |
|---|---|---|---|
| `0000c820-…` servis | | | panel servisi |
| `C821` | 0x0006 | write, write-no-rsp | **komutlar** ([çerçeveleme](02-framing.md)) |
| `C822` | 0x0008 | write, write-no-rsp | **veri parçaları** ([transfer](04-transfers.md)) |
| `C823` | 0x000A | notify | **panel cevapları** |
| `0000ae00-…` servis | | | JieLi OTA |
| `AE01` | | write-no-rsp | OTA verisi — **yazılmaz** |
| `AE02` | | notify | OTA cevapları (`FE DC BA …` ile başlar) |

UUID'lerin tamamı Bluetooth taban UUID'sini kullanır: `0000XXXX-0000-1000-8000-00805f9b34fb`.

Referans istemci her iki yazma karakteristiğinde de cevaplı yazma (write request) kullanır.
Üretici uygulaması da öyle yapar.

## 1.3 MTU ve parça boyutu

| Değer | Kaynak |
|---|---|
| Windows/bleak ile anlaşılan ATT MTU: 517 | Doğrulandı |
| Uygulamanın istediği MTU: 472 | APK |
| Parça veri boyutu: **446 bayt** (MTU 472 − 26), paket toplamı 459 bayt | APK, Doğrulandı |

Referans istemci, MTU daha büyük olsa bile 446 baytlık parçalar kullanır. Uygulamanın kullandığı
değer budur; firmware tamponunun daha büyük paketleri kabul ettiği doğrulanmadı.

## 1.4 Bağlantı sırası

```mermaid
sequenceDiagram
    participant A as İstemci
    participant P as Panel
    A->>P: bağlan
    A->>P: C823 notify aboneliği (CCCD = 0x0001)
    A->>P: MTU isteği (uygulama: 472)
    A->>P: C821 5A 01 01 01 (durum/şifre sorgusu)
    P-->>A: C823 5A 01 0B … (sürüm, şifre, parlaklık)
    A->>P: C821 53 01 01 LL (dil; isteğe bağlı)
```

- Panel bağlantı açılınca kendiliğinden veri göndermez (Doğrulandı).
- Panel **tek bağlantı** kabul eder. Üretici uygulaması bağlıyken başka bir merkezi cihaz paneli taramada bile göremez (Doğrulandı).
- Kopmadan sonra panel yaklaşık 30 sn içinde yeniden reklam yayınlar (Doğrulandı, 2026-11-01).

## 1.5 Açık konular

- Üretici verisindeki 4. ve 6. baytların panel boyutu olduğu, farklı boyutta bir panelle doğrulanmalı.
