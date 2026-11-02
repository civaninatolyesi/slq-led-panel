# Doğrulama raporu — SLQ Studio 1.0.0, 2026-11-02

## Özet

SLQ Studio'nun protokol katmanı (TypeScript) ve BLE taşıması gerçek bir panelde denendi.
**20 adımın 20'si panel tarafından kabul edildi** (ST=1, eksiksiz parça onayları ve transfer sonu cevabı).
Ölçütler cevap düzeyindedir: bu turda panelin görüntüsü gözlemci tarafından tek tek işaretlenmedi.
Görsel gözlem gerektiren tek yeni bilgi (dar Türkçe glifler) aşağıda **Açık** olarak listelenmiştir.

## Ortam

| | |
|---|---|
| Panel | SLQ-B555F7, firmware 1.0.6 (durum sorgusu cevabından), 48×12 RGB |
| İstemci | Windows 11, Electron 45 (Chromium Web Bluetooth), SLQ Studio 1.0.0 derlemesi |
| Araç | `app/scripts/hwtest.cjs`: derlenmiş uygulamayı açar, uygulamanın kendi bağlantı yoluyla bağlanır |
| Bağlantı süresi | 3,6 sn (seçiciden GATT hazır olana kadar) |

## Bayt uyumluluğu (donanımsız)

`app/src/core/protocol.test.ts`, TypeScript portunun Python referans istemcisiyle aynı baytları ürettiğini
denetler (vektörler `tools/gen_test_vectors.py`): 25 komut çerçevesi, CRC-16/CRC-32C kontrol değerleri,
1024 baytlık verinin parçalanması, 91 font glifinin dönüşümü, "HELLO12" metin kodlaması, 17 hazır animasyonun
geçerli 48×12 GIF üretmesi. **32/32 test geçti.**

## Donanım sonuçları

| # | Adım | Sonuç | Süre | Ayrıntı |
|---|---|---|---|---|
| 1 | Durum sorgusu | ✅ | 39 ms | firmware 1.0.6, şifre yok, parlaklık 100 |
| 2 | Parlaklık 40 (sessiz komut) | ✅ | 119 ms | yazma onaylandı |
| 3 | Ekran kapat | ✅ | 43 ms | ST=1 |
| 4 | Ekran aç | ✅ | 93 ms | ST=1 |
| 5 | Metin "SLQ STUDIO", sola kayma | ✅ | 173 ms | 160 B, 1 parça |
| 6 | Türkçe dar glifler "ŞÜKRÜ ÇİĞ ığüöçş" | ✅ | 301 ms | 256 B, 1 parça, tamamı TİP 3 |
| 7 | Metin stili: lazer + gradyan 3 | ✅ | 76 ms | ST=1 |
| 8 | Harf başına gökkuşağı + "♥" (TİP 4) | ✅ | 256 ms | 124 B, karışık TİP 3/4 |
| 9 | GIF: atan kalp | ✅ | 442 ms | 813 B, 2 parça |
| 10 | GIF: gökkuşağı | ✅ | 4650 ms | 12 995 B, 30 parça |
| 11 | GIF: bakan gözler | ✅ | 997 ms | 1765 B, 4 parça |
| 12 | Saat stili 1 | ✅ | 38 ms | ST=1 |
| 13 | Bisiklet sağ sinyal | ✅ | 57 ms | ST=1 |
| 14 | Bisiklet hız 23.4 | ✅ | 31 ms | ST=1 |
| 15 | Grafiti: yeni tuval + 12 piksel (yatay ayna) | ✅ | 591 ms | ST=1, piksel yazmaları onaylandı |
| 16 | Grafitiden çık | ✅ | 37 ms | ST=1 |
| 17 | Müzik ritmi, 50 çerçeve + kapat | ✅ | 5427 ms | `0D 02` ST=1 |
| 18 | Playlist: metin + 2 GIF | ✅ | 6012 ms | 3 öğe, IDX 1..3 |
| 19 | Zamanlayıcı kapalı (EN=00) | ✅ | 36 ms | ST=1 |
| 20 | Parlaklık 60 | ✅ | 29 ms | |

## Bulgular

| Bulgu | Durum |
|---|---|
| Web Bluetooth (Electron/Chromium, Windows) 446 baytlık parçaları sorunsuz taşıyor; parça boyutu düşürme yedeği devreye girmedi | Doğrulandı |
| Ardışık parça yazması ~150 ms/parça (cevaplı yazma + onay bekleme) | Doğrulandı |
| Uygulamanın ürettiği dar Türkçe glifler (TİP 3, aksan eklenmiş) panel tarafından kabul ediliyor | Doğrulandı (cevap düzeyinde) |
| Aynı gliflerin panelde doğru göründüğü | **Açık** — gözle doğrulanmalı |
| TİP 3 boşluk karakteri (12 sıfır bayt) | Kabul edildi; görünüm **Açık** |

## Denenmeyenler

| Konu | Neden |
|---|---|
| Android uygulaması (Capacitor) | APK yerelde derlenmedi; ilk derleme GitHub Actions'ta |
| Tarayıcı (PWA) ve Linux masaüstü | Bu turda donanımla denenmedi |
| Reset (`50`) | Panel ayarlarını sildiği için smoke testten bilerek çıkarıldı (2026-11-02 protokol raporunda doğrulandı) |

## Tekrarlama

```bash
cd app
npm run hwtest -- SLQ-B555F7     # VS Code terminalinde önce: unset ELECTRON_RUN_AS_NODE
```

Test panelin playlist'ini değiştirir; bitince panel test playlist'ini oynatır.
