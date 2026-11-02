# Güvenlik

## Panel güvenliği

SLQ paneller bir JieLi BLE yongası kullanır ve kablosuz yazılım güncellemesi (OTA) kanalı açıktır.
Bu projenin temel kuralı paneli bozabilecek hiçbir yolu sunmamaktır:

| Risk | Önlem |
|---|---|
| OTA karakteristiği (AE01) yanlış veriyle paneli kalıcı bozabilir | Ne Python kütüphanesi ne SLQ Studio bu karakteristiği tanımlar |
| `52` şifre komutu paneli kilitleyebilir | Uygulamada yok; geliştirici konsolu engeller |
| `57` panel tipi komutu paneli sol/sağ yarı olarak yapılandırır | Uygulamada yok; geliştirici konsolu engeller |
| `50` reset ayarları siler | Onay penceresi |

Bu kurallardan birini aşan bir yol bulursan (ör. konsoldan engelin atlatılması) lütfen bildir.

## Bluetooth güvenliği

Panel BLE eşleştirmesi (pairing) ya da bağlantı şifrelemesi istemez (doğrulandı): menzildeki herhangi bir cihaz,
panele başka bir cihaz bağlı değilken bağlanıp içerik gönderebilir. Bu firmware'in davranışıdır ve bu proje
tarafından değiştirilemez. Panel aynı anda tek bağlantı kabul ettiği için bağlı kaldığın sürece başkası bağlanamaz.

Panelin bir şifre özelliği vardır (`52`, durum sorgusunda "şifre tanımlı" bayrağı), ancak denenmedi;
firmware'in şifreyi kendisi mi uyguladığı yoksa yalnızca üretici uygulamasının mı sorduğu bilinmiyor
([komut referansı](docs/protocol/03-commands.md#denenmeyenler)).

## Bildirme

Uygulamada ya da kütüphanede bir güvenlik açığı bulursan herkese açık issue açmak yerine GitHub'ın
**Security → Report a vulnerability** (özel bildirim) özelliğini kullan. Paneli bozma riski taşıyan
konularda ayrıntıyı herkese açık paylaşmamanı rica ederiz.
