# 5. Veri biçimleri

## 5.1 Metin kodlama

Metin verisi, karakter başına bir kayıttan oluşur:

```
TİP | R | G | B | GLİF
```

| TİP | Glif | Genişlik | Ekrana sığan | Durum |
|---|---|---|---|---|
| `03` | yerleşik font, 12 bayt | 6 px | 8 karakter | Doğrulandı (dönüştürülmüş biçimle) |
| `04` | bitmap, 24 bayt | 12 px | 4 karakter | Doğrulandı |

RGB, karakterin rengidir. Karakter bazında farklı renk verilebilir.

### TİP 4 — 12×12 bitmap

Sütun sütun yazılır, sütun başına 2 bayt (12 sütun × 2 = 24 bayt):

```
bayt 2k   : sütun k, satır 0..7   (bit7 = satır 0)
bayt 2k+1 : sütun k, satır 8..11  (bit7 = satır 8, bit3..0 kullanılmaz)
```

Her karakter için çalışır (Türkçe harfler, semboller). Referans istemci karakteri Arial 11 pt ile çizer:
`slq/text.py:glyph_bitmap`.

### TİP 3 — yerleşik font (6×12)

Üretici uygulamasında 91 karakterlik bir font tablosu vardır (`!`–`~`, boşluk yok): `slq/data/font12.json`.
Tablo **ham haliyle gönderilirse panelde bozuk görünür** (Doğrulandı). Gönderimden önce uygulamanın
`Text12.convertToStandardFormat` dönüşümünden geçmelidir. Dönüşümün çıktısı TİP 4 ile aynı düzendedir,
yalnızca 6 sütunluktur:

```
ham:  bayt 0..5  -> sütun 0..5, satır 0..7  (bit7 = satır 0)
      bayt 6..11 -> sütun 0..5, satır 8..11 (bit6 = satır 8 … bit3 = satır 11)
std:  bayt 2k, 2k+1 -> sütun k [üst, alt], bit7 = en üst satır
```

### Önerilen kodlama

Referans istemcinin varsayılanı `mode="mixed"`: tablodaki karakterler TİP 3 (dar), diğerleri TİP 4.
Doğrulandı ("HELLO 12": boşluk TİP 4, diğerleri TİP 3).

### Tabloda olmayan karakterler için dar glif

TİP 3 kaydı glifin baytlarını kendisi taşır; firmware yerleşik bir font kullanmaz. Bu yüzden tabloda olmayan
karakterler için de 6×12 glif üretilebilir. SLQ Studio Türkçe harfleri temel harfe aksan ekleyerek üretir
(`app/src/core/text.ts`):

| Harf | Temel | Eklenen |
|---|---|---|
| Ç Ş / ç ş | C S / c s | 9–10. satırlarda çengel |
| Ğ / ğ | G / g | 0–1. / 2–3. satırlarda kesme işareti |
| Ü Ö / ü ö | U O / u o | 0. / 3. satırda iki nokta |
| İ / ı | I / i | 0. satıra nokta / 2. satırdaki nokta kaldırılır |
| boşluk | — | 12 sıfır bayt |

Panel bu kayıtları kabul eder (ST=1, [uygulama doğrulama raporu](../verification/2026-11-02-app-report.md));
panelde doğru göründükleri **Açık**. Python istemcisi bu karakterleri hâlâ TİP 4 bitmap olarak gönderir.

### Görüntüleme davranışı

- Ekrana sığmayan metin, `FIXED` efektte sayfalara bölünür ("HELL" → "O") (Doğrulandı).
- TİP 4 kullanıldığında harfler 12 px hücreye ortalandığı için aralıklı görünür. Dar görünüm için TİP 3 kullanılmalı.

## 5.2 GIF

| Kural | Değer |
|---|---|
| Boyut | 48×12 piksel |
| Biçim | standart GIF87a/GIF89a, global ya da yerel palet |
| Animasyon | çok kareli GIF, NETSCAPE döngü uzantısı (loop=0) |
| Kare optimizasyonu | Pillow'un kırpılmış (delta) kareleri sorunsuz oynatılır (Doğrulandı) |
| Efektler | **uygulanmaz**. Kayma vb. hareket karelerin içine çizilmelidir |

Doğrulanan örnekler: tek kareli 133 bayt, 12 kareli 887 bayt (2 parça).
Uygulama GIF'leri `AnimatedGifEncoder` ile üretir (kare başına yerel palet, `setRepeat(0)`).

## 5.3 Efektler

Metin efektleri (`02 01` başlat ve `54 01` stil komutlarında EFFECT alanı). Numaralar firmware'e aittir;
uygulamanın metin ekranındaki buton sırası farklıdır.

| Değer | Görünüm | Durum |
|---|---|---|
| 0 | sabit (sığmazsa sayfalar) | Doğrulandı |
| 1 | sola kayma | Doğrulandı |
| 2 | sağa kayma; karakter sırası ters görünür ("OLLEH") | Doğrulandı |
| 3 | yukarı kayma (sayfa sayfa) | Doğrulandı |
| 4 | aşağı kayma | Doğrulandı |
| 5 | sayfa geçişi (uygulama: kar) | Kısmen, efekt ayırt edilmedi |
| 6 | sayfa geçişi (uygulama: perde) | Kısmen, efekt ayırt edilmedi |
| 7 | lazer | Doğrulandı |

Sağa kaymada metni doğru okutmak için karakter sırasını ters göndermek gerekebilir (Açık).

## 5.4 Renkler

| COLOR_IDX | Anlam | Durum |
|---|---|---|
| 0 | RGB alanı / glif RGB'si kullanılır | Doğrulandı |
| 3 | dikey gradyan: üst mavi → orta mor → alt kırmızı | Doğrulandı |
| 1, 2, 4..7 | hazır gradyanlar | Açık |

BG_IDX için aynı tablo geçerlidir (APK). Yalnızca 0 denendi.

## 5.5 Açık konular

- COLOR_IDX 1, 2, 4..7'nin görünümleri.
- Efekt 5 ve 6'nın gerçek animasyonları. Daha uzun bir metinle gözlenmeli.
