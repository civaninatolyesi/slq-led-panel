# Dokümantasyon

## Okuma sırası

Protokolü ilk kez okuyorsan sırayla ilerle. Bir komuta bakıyorsan doğrudan
[komut referansına](protocol/03-commands.md) git.

| # | Belge | Ne zaman okunur |
|---|---|---|
| 1 | [Taşıma katmanı](protocol/01-transport.md) | Panel nasıl bulunur, hangi karakteristiğe ne yazılır |
| 2 | [Çerçeveleme](protocol/02-framing.md) | Komut ve cevap çerçevesi, CRC'ler, durum kodları |
| 3 | [Komut referansı](protocol/03-commands.md) | Tüm komutlar, bayt düzenleri, örnekler |
| 4 | [Veri transferi](protocol/04-transfers.md) | Metin, GIF ve playlist yükleme akışları |
| 5 | [Veri biçimleri](protocol/05-data-formats.md) | Glif kodlama, font, GIF kuralları, efekt ve renk tabloları |
| — | [SLQ Studio uygulama rehberi](app.md) | Uygulamanın kullanımı, mimarisi, derleme ve yayınlama |
| — | [Geliştirici rehberi](development.md) | Kurulum, kütüphane API'si, araçlar, yeni komut ekleme |
| — | [Tersine mühendislik notları](reverse-engineering.md) | Bilgi nereden geldi, uygulama ile firmware farkları |
| — | [Doğrulama raporu 2026-11-02](verification/2026-11-02-report.md) | Her özelliğin donanım testi sonucu |
| — | [SLQ Studio doğrulama raporu 2026-11-02](verification/2026-11-02-app-report.md) | Uygulamanın Python'la bayt uyumu ve donanım duman testi |
| — | [Katkı rehberi](../CONTRIBUTING.md) · [Güvenlik](../SECURITY.md) | Katkı süreci, panel güvenliği kuralları |

## Etiketler

Spesifikasyon her bilginin kaynağını belirtir:

| Etiket | Anlamı |
|---|---|
| **Doğrulandı** | Donanımda denendi, sonuç gözlendi ve kaydedildi (`verification/` altında kanıt var) |
| **APK** | Üretici uygulamasının kodundan okundu, donanımda denenmedi |
| **Açık** | Bilinmiyor ya da çelişkili; ilgili belgede "Açık konular" başlığında listelenir |

## Terimler

| Terim | Anlamı |
|---|---|
| Panel | 48×12 RGB LED modül, BLE çevre birimi (peripheral) |
| Komut | C821'e yazılan, CRC16 ile biten kısa çerçeve |
| Transfer | Bir başlat komutu ve ardından C822'ye yazılan parçalardan oluşan veri yükleme akışı |
| Parça (chunk) | C822'ye yazılan, kendi başlığı ve CRC'si olan veri paketi |
| ST | Cevap çerçevesindeki durum baytı (1 kabul, 0 ret, 3 aynı veri) |
| Program | Panelin o an gösterdiği içerik (metin, GIF, playlist, saat…) |
