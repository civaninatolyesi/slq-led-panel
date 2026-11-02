# 3. Komut referansı

Bütün komutlar C821'e yazılır ve [2.1'deki çerçeveyi](02-framing.md#21-komut-çerçevesi-c821) kullanır.
Tablolarda yalnızca PAYLOAD gösterilir; `CMD SUB LEN` başlığı ve CRC16 her zaman eklenir.
"Python" sütunu `slq/protocol.py`'deki kurucu fonksiyondur.

## Özet

| CMD SUB | Komut | Cevap | Durum | Python |
|---|---|---|---|---|
| `5A 01` | [Durum sorgusu](#durum-sorgusu-5a-01) | `5A 01 0B …` | Doğrulandı | `query_info()` |
| `00 01` | [Parlaklık](#parlaklık-00-01) | sessiz | Doğrulandı | `brightness()` |
| `00 03` | [Ekran aç/kapa](#ekran-açkapa-00-03) | ST | Doğrulandı | `power()` |
| `51 01` | [180° döndürme](#180-döndürme-51-01) | ST | Doğrulandı | `rotate_180()` |
| `02 01` | [Metin transferi başlat](#metin-transferi-başlat-02-01) | ST | Doğrulandı | `text_start()` |
| `54 01` | [Metin stili](#metin-stili-54-01) | ST | Doğrulandı | `text_style()` |
| `08 02` | [Resim transferi başlat](#resim-transferi-başlat-08-02) | ST | Doğrulandı | `image_start()` |
| `01 02` | [Transfer sonu](#transfer-sonu-01-02) | `01 02 03 01 …` | Doğrulandı | `transfer_done()` |
| `0A 01` / `0A 02` | [Playlist başlat / temizle](#playlist-0a) | ST | Doğrulandı | `playlist_begin()`, `playlist_clear()` |
| `0B 01` | [Grafiti modu](#grafiti-modu-0b-01) | ST | Doğrulandı | `graffiti()` |
| `0C 01` | [Piksel](#piksel-0c-01) | sessiz | Doğrulandı | `pixel()` |
| `0D 01` / `0D 02` | [Ritim verisi / kapat](#müzik-ritmi-0d) | sessiz / ST | Doğrulandı | `rhythm()`, `rhythm_off()` |
| `10 01` | [Bisiklet sinyali](#bisiklet-10-01-11-01) | ST | Doğrulandı | `bike_signal()` |
| `11 01` | [Bisiklet hızı](#bisiklet-10-01-11-01) | ST | Doğrulandı | `bike_speed()` |
| `0E 01` | [Saat göstergesi](#saat-göstergesi-0e-01) | ST | Doğrulandı | `clock()` |
| `0F 01` | [Zamanlayıcı](#zamanlayıcı-0f-01) | ST | Doğrulandı | `schedule()` |
| `53 01` | [Dil](#diğer) | sessiz | Doğrulandı | `language()` |
| `55 01` | [Senkron](#diğer) | sessiz | Doğrulandı | `sync()` |
| `50 01` | [Reset](#diğer) | ST | Doğrulandı | `reset()` |
| `52 01` / `57 01` | [Şifre / panel tipi](#denenmeyenler) | — | APK | — |
| `00 04/06/07`, `05 03`, `09`, `12`, `18`, `80` | [Desteklenmeyenler](#desteklenmeyenler) | ST=0 / sessiz | Doğrulandı | — |

---

## Durum sorgusu `5A 01`

PAYLOAD: `01`. Uygulama bağlantıdan hemen sonra gönderir.

Cevap: `5A 01 0B` + 11 bayt.

| Bayt | Örnek | Anlam | Kaynak |
|---|---|---|---|
| 0 | `01` | ? | Açık |
| 1 | `06` | firmware alt sürümü (1.0.**6**) | Açık (advertising ile aynı) |
| 2 | `00` | 1 = şifre tanımlı | APK |
| 3–8 | `00…` | şifre rakamları (şifre varsa) | APK |
| 9 | `00` | ? | Açık |
| 10 | `25` | **anlık parlaklık** (0x25 = 37) | Doğrulandı |

Örnek: `5a 01 01 01 6c 83` → `5a 01 0b 01 06 00 00 00 00 00 00 01 00 64 c9 a2`

## Parlaklık `00 01`

PAYLOAD: `LL`, 1..100 (uygulama en az 1 gönderir). Cevap yok. Örnek: `00 01 01 0a 73 d0` (%10).

## Ekran aç/kapa `00 03`

PAYLOAD: `01` aç, `00` kapat. Cevap `00 03 01 01`. Kapatmak içeriği silmez.

## 180° döndürme `51 01`

PAYLOAD: `01` açık, `00` kapalı. Cevap `51 01 01 01`. Kask ters takıldığında kullanılır.

## Metin transferi başlat `02 01`

PAYLOAD (15 bayt). Akış: [4.2](04-transfers.md#42-metin).

| Ofset | Alan | Açıklama |
|---|---|---|
| 0 | IDX | 0 = doğrudan göster, 1..N = playlist öğesi |
| 1–2 | DATA_LEN | metin verisinin uzunluğu, u16 BE |
| 3 | EFFECT | [efekt tablosu](05-data-formats.md#53-efektler) |
| 4 | SPEED | 0..100 |
| 5 | COLOR_IDX | 0 = glif başına RGB; 1..7 hazır gradyan |
| 6 | BG_IDX | 0 = BG_RGB |
| 7–9 | BG_R BG_G BG_B | arka plan rengi |
| 10 | ORIENT | 0 yatay, 1 dikey |
| 11–14 | CRC32C | metin verisinin CRC-32C'si, BE |

Cevap `02 01 01 01` → parçaları gönder; `02 01 01 03` → aynı metin zaten var.

## Metin stili `54 01`

Paneldeki metnin görünümünü, metni yeniden göndermeden değiştirir. PAYLOAD (11 bayt):

| Ofset | Alan | Açıklama |
|---|---|---|
| 0 | EFFECT | [efekt tablosu](05-data-formats.md#53-efektler) |
| 1 | SPEED | 0..100 (10 belirgin yavaş, Doğrulandı) |
| 2 | COLOR_IDX | 0 = aşağıdaki RGB; 1..7 hazır gradyan (3 = mavi→mor→kırmızı) |
| 3–5 | R G B | yazı rengi |
| 6 | BG_IDX | 0 = aşağıdaki RGB |
| 7–9 | R G B | arka plan rengi |
| 10 | ORIENT | 0 yatay, 1 dikey |

Cevap `54 01 01 01`. Resimlere (GIF) etkisi yoktur (Doğrulandı).

## Resim transferi başlat `08 02`

PAYLOAD: `IDX CRC32C[4]`. IDX 0 = doğrudan göster, 1..N = playlist öğesi. Veri uzunluğu bu komutta
yoktur, parça başlıklarında gider. Akış: [4.3](04-transfers.md#43-resim-gif).

Cevap `08 02 01 01` → parçaları gönder; `08 02 01 03` → aynı resim zaten var.

## Transfer sonu `01 02`

Son parçanın onayından sonra gönderilir. Uygulama bu komuta CRC'yi **iki kez** ekler ve referans istemci de
aynısını yapar: `01 02 01 01 48 60 1e 1e`. Tek CRC'li biçimin kabul edilip edilmediği denenmedi (Açık).

Cevap: `01 02 03 01 CMD SUB`. ST=1 ve başlatma komutunun yankısı (metin `02 01`, resim `08 02`).
`01 02 01 XX` (XX > 1) veri hatası demektir (APK).

## Playlist `0A`

| Komut | PAYLOAD | Açıklama |
|---|---|---|
| `0A 01` başlat | `N` (öğe sayısı) | Cevap `0A 01 01 01`; ardından her öğe IDX = 1..N ile transfer edilir |
| `0A 02` temizle | `00` | Cevap `0A 02 01 01`; panel **fabrika demo animasyonlarına** döner |

Panel öğeler arasında kendisi geçiş yapar (Doğrulandı). Öğe başına süre ayarı bulunamadı (Açık).

## Grafiti modu `0B 01`

PAYLOAD: `MODE`. 1 = tuvali temizle ve gir, 2 = gönderim bitti (APK), 4 = çık ve önceki programa dön.
Cevap `0B 01 01 01`.

## Piksel `0C 01`

PAYLOAD: `MODE X Y R G B`. X 0..47 (sütun, soldan), Y 0..11 (satır, üstten). Cevap yok.

| MODE | Anlam | Kaynak |
|---|---|---|
| 0 | çiz | Doğrulandı |
| 1 | çiz + yatay simetri (firmware aynayı kendisi çizer) | Doğrulandı |
| 2 | çiz + dikey simetri | Doğrulandı |
| 3 | "tümünü kaydır" | APK, denenmedi |
| 4 | sil | Doğrulandı |

Önce `0B 01 01 01` ile grafiti moduna girilmelidir.

## Müzik ritmi `0D`

| Komut | PAYLOAD | Açıklama |
|---|---|---|
| `0D 01` veri | `STYLE B0..B11` (13 bayt) | STYLE 0..4; 12 bant, her biri 0..16. Cevap yok. Müzik boyunca sürekli gönderilir |
| `0D 02` kapat | `01` | Cevap `0D 02 01 01`; önceki program döner |

Ritim modunu ayrıca açan bir komut yoktur, ilk veri çerçevesi modu açar. Uygulama sesi FFT ile 12 banda böler.

## Bisiklet `10 01`, `11 01`

| Komut | PAYLOAD | Açıklama |
|---|---|---|
| `10 01` sinyal | `N` | 0 sol sinyal, 1 sağ sinyal, 2 sürüş, 3 durdu |
| `11 01` hız | `UNIT INT DEC` | UNIT 0 km/h, 1 mph; hız = INT + DEC/10 (25.5 → `00 19 05`) |

Cevap `10 01 01 01` / `11 01 01 01`.

## Saat göstergesi `0E 01`

Üretici uygulamasında kullanılmayan, belgelenmemiş özellik. PAYLOAD (10 bayt):

| Ofset | Alan | Açıklama |
|---|---|---|
| 0 | STYLE | 0..3. 0: saat/dakika alt alta + kalpler; 1: alt alta; 2: solda kırmızı animasyon; 3: ? |
| 1 | Z | ? (0 ile 1 arasında görünür fark bildirilmedi) |
| 2 | Z2 | ? (0 ile 1 arasında görünür fark bildirilmedi) |
| 3–4 | YIL | u16 BE |
| 5 | AY − 1 | 0..11 |
| 6 | GÜN − 1 | 0..30 |
| 7–9 | SAAT DAKİKA SANİYE | panel saatini ayarlar |

Cevap `0E 01 01 01`.

## Zamanlayıcı `0F 01`

Belirli saatlerde otomatik açma/kapama. Panel saatini de ayarlar. PAYLOAD (13 bayt):

| Ofset | Alan | Açıklama |
|---|---|---|
| 0–1 | YIL | u16 BE |
| 2 | AY − 1 | |
| 3 | GÜN − 1 | |
| 4–6 | SAAT DAKİKA SANİYE | şu anki zaman |
| 7–8 | AÇ_SAAT AÇ_DAKİKA | |
| 9 | AÇ_EN | etkin baytı, aşağıda |
| 10–11 | KAPA_SAAT KAPA_DAKİKA | |
| 12 | KAPA_EN | etkin baytı |

**Etkin baytı:** bit0 = 1 etkin, bit1..7 = haftanın günleri. `FF` her gün etkin, `00` kapalı.

> Uygulamadaki `buildEnableByte` bit0'ı ters adlandırıyor gibi görünür. Donanımda `FE` çalışmadı, `FF` çalıştı (Doğrulandı).
> Zamanlayıcıyı kapatmak için `01` değil **`00`** yazılmalı. `01`, "etkin, hiçbir gün seçilmemiş" anlamına gelir.
> Hangi bitin hangi güne karşılık geldiği doğrulanmadı (Açık).

Cevap `0F 01 01 01`.

## Diğer

| Komut | PAYLOAD | Açıklama | Cevap |
|---|---|---|---|
| `53 01` dil | `L` (0 Çince, 1 diğer) | görünür etki gözlenmedi | yok |
| `55 01` senkron | `01` | uygulama içerik gönderdikten sonra gönderir; görünür etki yok | yok |
| `50 01` reset | `01` | panel ayarlarını sıfırlar (testten sonra parlaklık 80'e döndü) | `50 01 01 01` |

## Denenmeyenler

Riskli oldukları için bilerek denenmedi; biçimler APK'dan alındı.

| Komut | PAYLOAD | Risk |
|---|---|---|
| `52 01` şifre ayarla | `MODE D1..D6` | paneli kilitleyebilir. Cevap `52 01 01 01` başarılı (APK) |
| `57 01` panel tipi | `T` | paneli sol/sağ yarı olarak yapılandırır |

## Desteklenmeyenler

Firmware 1.0.6'da çalışmadığı doğrulanan, uygulamada bulunan komutlar:

| Komut | Uygulamadaki işlevi | Gözlem |
|---|---|---|
| `00 04 00 01 EE` | resim efekti | ST=0. 1 baytlık LEN biçimi (`00 04 01 EE`) sessiz ve etkisiz |
| `00 06 00 01 x`, `00 07 00 01 x` | döndürme, hizalama | ST=0 |
| `05 03 00 04 …` | hazır animasyon | ST=0 |
| `18 02 06 YUVA 00 CRC32C` | kumanda yuvasına resim | sessiz; zorla gönderilen parçalar da onaylanmadı |
| `09 01 05 0F 01 EF ID 01` | kumanda tuşu | sessiz, etkisiz |
| `80 01 01 01` | kumanda reset | sessiz, etkisiz |
| `12 01 0F …` | kumanda yuvasına metin | denenmedi; aynı aileden |
