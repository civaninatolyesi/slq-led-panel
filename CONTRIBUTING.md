# Katkı rehberi

Katkılar memnuniyetle karşılanır: hata bildirimi, farklı panel/firmware raporları, çeviri, yeni animasyon,
dokümantasyon ya da kod. *English contributions are welcome too.*

## En değerli katkı: panel raporu

Proje yalnızca firmware 1.0.6'lı 48×12 panelde doğrulandı. Farklı bir panelin varsa
**"Panel uyumluluğu"** issue şablonunu doldur: model, firmware sürümü (uygulamada Ayarlar → Panel),
hangi özelliklerin çalıştığı. Spesifikasyondaki **Açık** konular ([listesi](docs/README.md#etiketler))
de gözlemle kapatılabilir.

## Geliştirme ortamı

| Parça | Gereksinim | Başlangıç |
|---|---|---|
| SLQ Studio (`app/`) | Node.js 22+, Chrome/Edge | [docs/app.md](docs/app.md#komutlar) |
| Android derlemesi | JDK 21, Android SDK (Android Studio) | `npm run android:sync && npm run android:open` |
| Python istemcisi (`slq/`) | Python 3.11+ | [docs/development.md](docs/development.md) |

## Değişiklik yaparken

1. Protokol değişikliği önce [komut referansına](docs/protocol/03-commands.md) yazılır; kaynağı
   (**Doğrulandı** / **APK** / **Açık**) belirtilir.
2. Python (`slq/protocol.py`) ve TypeScript (`app/src/core/protocol.ts`) birlikte güncellenir.
   `python tools/gen_test_vectors.py` ile vektörleri yenile, `cd app && npm test` geçmeli.
3. Arayüz metinleri her iki dilde yazılır: `t('Türkçe', 'English')`.
4. Donanıma dokunan değişiklikler panelde denenir: `cd app && npm run hwtest -- SLQ-XXXXXX`.
   Sonuç PR açıklamasına eklenir.
5. Kullanıcıya görünen her değişiklik [CHANGELOG.md](CHANGELOG.md)'ye eklenir.

Gönderimden önce:

```bash
cd app
npm run typecheck
npm test
npm run build
```

## Güvenlik kuralları

Bu kurallar pazarlık konusu değildir; ihlal eden PR birleştirilmez:

- **AE01/AE02 (JieLi OTA) karakteristiklerine yazan kod eklenmez.** Paneli kalıcı olarak bozabilir.
- `52` (şifre) ve `57` (panel tipi) komutları arayüze eklenmez.
- Kullanıcı ayarlarını silen işlemler (`50` reset) onay ister.

Ayrıntılar: [SECURITY.md](SECURITY.md).

## Yasal

- Üretici APK'sı, ondan decompile edilmiş kod ya da üreticinin görselleri depoya konmaz.
- Uygulamadaki animasyonlar kodla üretilir; telifli görsel/karakter eklenmez.
- Katkıların [MIT lisansı](LICENSE) altında yayımlanmasını kabul etmiş sayılırsın.
