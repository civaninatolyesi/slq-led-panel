# Yeni animasyon ekleme rehberi

Bu rehber SLQ Studio'ya (`app/`) yeni bir hazır animasyon eklemek için gereken her şeyi tek yerde toplar.
Hem insanlar hem de kodlama asistanları (Claude, Copilot vb.) için yazıldı: kurallar, API, şablonlar,
önizleme ve kontrol listesi. Kod: [`app/src/core/animations/`](../app/src/core/animations/).

## İçindekiler

1. [Hızlı başlangıç](#1-hızlı-başlangıç)
2. [Panel kuralları](#2-panel-kuralları)
3. [Mimari](#3-mimari)
4. [API](#4-api)
5. [Şablonlar](#5-şablonlar)
6. [Önizleme ve test](#6-önizleme-ve-test)
7. [Kontrol listesi](#7-kontrol-listesi)
8. [Sık yapılan hatalar](#8-sık-yapılan-hatalar)

---

## 1. Hızlı başlangıç

1. Temaya uygun dosyayı seç ([3. bölüm](#3-mimari)). Hiçbiri uymuyorsa `presets/` altında yeni dosya aç.
2. `definePreset({...})` ile animasyonu yaz ve dışa aktar ([şablonlar](#5-şablonlar)).
3. [`index.ts`](../app/src/core/animations/index.ts) içindeki `CATALOG` dizisine, galeride görünmesini
   istediğin sıraya ekle. **Arayüzde başka hiçbir şeyi değiştirme**: galeri, etiket filtresi, renk seçici ve
   gönderme otomatik çalışır.
4. Önizle: `cd app` sonra `PRESET=<kimlik> npm run preview:preset` ([6. bölüm](#6-önizleme-ve-test)).
   Çıkan PNG'ye bak, gerekirse düzelt.
5. `npm run typecheck` ve `npm test` çalıştır. Sözleşme testleri yeni animasyonu otomatik kapsar.

En küçük örnek:

```ts
// app/src/core/animations/presets/classic.ts
import { scale } from '../color'
import { sequence } from '../timeline'
import { definePreset } from '../types'

export const pulse = definePreset({
  id: 'pulse',
  name: { tr: 'Nabız', en: 'Pulse' },
  tags: ['ambient'],
  color: [0, 160, 255],                         // varsa arayüzde renk seçici çıkar
  make: (c) =>
    sequence(20, 60, (g, i) => {
      const k = 0.5 - 0.5 * Math.cos((i / 20) * 2 * Math.PI)   // 0 -> 1 -> 0, dikişsiz döngü
      g.paint((x, y) => (Math.hypot(x - 23.5, (y - 5.5) * 2) < 4 + k * 14 ? scale(c, k) : null))
    }),
})
```

## 2. Panel kuralları

Panel 48×12 RGB LED. Animasyon kodla üretilen karelerden oluşan bir GIF olarak gönderilir; firmware GIF'e
efekt uygulamaz, **hareketin tamamı karelerin içine çizilir**. Ayrıntı:
[veri biçimleri §5.2](protocol/05-data-formats.md).

| Kural | Değer | Neden |
|---|---|---|
| Boyut | 48×12. x: 0..47 soldan sağa, y: 0..11 yukarıdan aşağı | Panel çözünürlüğü. Ekran dışına çizim sessizce kırpılır |
| Kare sayısı | 1..80 (`MAX_FRAMES`) | Uygulama sınırı. Panel belleği ve gönderim süresi |
| Kare süresi | ≥ 20 ms. Pratikte 40-200 ms, duraklamalar 300-1600 ms | GIF kodlayıcı 20 ms altını 20'ye çeker |
| GIF boyutu | < 40 KB (test sınırı) | 13 KB ≈ 30 parça ≈ 4,6 sn gönderim. Büyük GIF yavaş gider |
| Renk sayısı | Kare başına ≤ 64 ise palet birebir kurulur | 64'ü aşan karelerde niceleme olur, renkler kayar. Düz renkli çizimler hem net hem küçük olur |
| Kenar yumuşatma yok | Tam renkli pikseller kullan | Ara tonlar panelde pembe/bulanık leke gibi görünür (Türk bayrağında denendi) |
| Siyah = kapalı LED | `[0,0,0]` hiç ışık vermez | Arka plan siyahtır. Çok koyu renkler (kanal başına ~25 altı) neredeyse görünmez |
| Belirleyicilik | `Math.random()`, `Date.now()` kullanma, `rng(seed)` kullan | Aynı animasyon her seferinde bit bit aynı GIF olmalı. Panel aynı CRC'yi görünce "aynı veri" der ve yüklemeyi atlar |
| Dikişsiz döngü | Son kareden ilk kareye geçiş sıçramamalı | GIF sonsuz döngüde oynar. Periyodik hareketlerde `i / n` ile tam tur kullan |
| Telif ve marka | Genel motifler serbest (ejderha/kedi gözü, kalp, alev, bayrak). Belirli bir karakterin adı, logosu ya da ayırt edici tasarımı kullanılmaz | Hepsi kodla üretilir. Karakter ve film adları marka olarak korunur: önayar adında, açıklamada, sürüm notunda ve tanıtımda geçmez |

12 px yükseklik çok azdır. Pratik ölçüler:

- Küçük şekiller en az 5-7 px olmalı. Daha küçüğü okunmaz (hilal "C", yıldız "+" olur).
- Yazı için `g.text()` kullan (panel fontu, 12 px). Dar mod (`'narrow'`) ekrana yaklaşık 8 karakter sığdırır.
- Gözler, yüzler gibi iki parçalı kompozisyonlarda merkezler genelde x ≈ 12 ve x ≈ 35'tir.

## 3. Mimari

```
app/src/core/animations/
  index.ts          CATALOG (galeri sırası), PresetRegistry örneği, dışa açık API
  types.ts          Preset arayüzü, PRESET_TAGS (etiketler + çeviriler), definePreset
  registry.ts       PresetRegistry: kimlik doğrulama, get/find/byTag, önbellekli kare üretimi
  canvas.ts         Canvas: bir kare üzerinde çizim (set/get/fill/fillRect/paint/sprite/text/copyFrom)
  timeline.ts       sequence / steps / still: kare dizisi kurucuları
  effects.ts        wave (dalgalanma), pushUp (dikey geçiş), scrollLeft (sonsuz kayma)
  color.ts          scale, mix, hsv, rng, BLACK, WHITE
  sprites.ts        HEART, HEART_BIG, CHEVRON, flipX, mirrorRows
  presets/
    classic.ts      tam ekran efektler: rainbow, fire, matrix, plasma, equalizer, stars, snow
    faces.ts        yüz/göz/kalp: heart, eyes, dragon-eyes, smile, hearts
    signals.ts      sürüş: left, right, brake, hazard, police, scanner
    turkish.ts      bayrak ve motifler: turkflag*, ayyildiz-shine, turkiye, kilim
  presets.test.ts   her önayar için sözleşme testleri + çizim temelleri testleri
  preview.test.ts   önizleme aracı (yalnızca PRESET verilince çalışır)
```

Bağımlılık yönü tek yönlüdür: `presets/*` → `timeline`, `effects`, `canvas`, `color`, `sprites` →
`../media`. Arayüz (`pages/Home.tsx`, `pages/Media.tsx`) yalnızca `index.ts`'e bağlıdır.

Tasarım ilkeleri:

- **Açık/kapalı:** Yeni animasyon eklemek yalnızca yeni kod ekler. Kayıt defteri, arayüz ve testler değişmez.
- **Tek sorumluluk:** Çizim (`Canvas`), zamanlama (`timeline`), hareket (`effects`), katalog (`PresetRegistry`)
  ve animasyonların kendisi (`presets/*`) ayrı modüllerdedir.
- **Saf üretim:** `make(color)` dış durum okumaz, yan etki üretmez. Aynı girdiye aynı kareleri verir.
- **Veri ve davranış ayrı:** `Frame` (piksel + süre) ortak veri tipidir. GIF kodlayıcı, stüdyo ve önizleme
  bunu kullanır. `Canvas` yalnızca üzerine çizim davranışı ekler (`Canvas.of(frame)`).

## 4. API

### Preset

```ts
interface Preset {
  id: string                    // kebab-case, kalıcı. Değiştirme (önbellek ve kullanıcı seçimleri bağlı)
  name: { tr: string; en: string }
  tags: PresetTag[]             // 'fun' | 'ride' | 'party' | 'ambient' | 'signal'
  color?: RGB                   // varsa renk seçici çıkar ve make bu rengi (ya da kullanıcınınkini) alır
  make(color: RGB): Frame[]
}
```

`color` yoksa animasyon kendi renklerini kullanır, `make`'in parametresi yok sayılır (`make: () => ...`).
`color` verdiysen animasyon bu rengi gerçekten kullanmalı. Test bunu denetler.

Yeni etiket gerekiyorsa `types.ts` içindeki `PRESET_TAGS`'e ekle. Galeri filtresi otomatik gelir.

### Canvas (bir kare)

| Metot | Açıklama |
|---|---|
| `set(x, y, c)` | Piksel boyar. Koordinatlar yuvarlanır, ekran dışı yok sayılır |
| `get(x, y)` | Piksel rengi. Ekran dışı için siyah |
| `isLit(x, y)` | Piksel yanıyor mu |
| `fill(c)` / `fillRect(x, y, w, h, c)` | Tüm ekranı ya da dikdörtgeni boyar |
| `paint((x, y) => RGB \| null)` | Tam ekran piksel fonksiyonu. `null` dönen piksele dokunmaz |
| `sprite(rows, ox, oy, color)` | Karakter deseni. `'.'` ve boşluk boş, diğer karakterler dolu. `color` fonksiyon olabilir: `(ch) => RGB \| null` |
| `text(s, x, c, mode?)` | Panel fontuyla yazı. Sonraki x'i döndürür |
| `copyFrom(src)` | Başka karenin piksellerini kopyalar |
| `delay` | Karenin süresi (ms), okunur/yazılır |
| `Canvas.blank(delay?, fill?)`, `Canvas.of(frame)` | Yeni kare / var olan kareyi sarmalama |

### timeline (kare dizileri)

| Fonksiyon | Ne zaman |
|---|---|
| `sequence(n, delay, (g, i) => …)` | n eşit süreli kare: dönen, kayan, simülasyon. `draw` sırayla çağrılır, kareler arası durum (parçacık konumları) taşıyabilir |
| `steps(items, delay, (g, item, i) => …)` | Bir değer tablosundan kare başına bir kare: pozlar, parlaklık dizisi, konum listesi. `delay` sabit ya da `(item, i) => ms` |
| `still(delay, g => …)` | Tek kare: bekleme, sabit görüntü. Çizimsiz `still(90)` karanlık bir kare verir |

Diziler düz `Frame[]` olduğundan birleştirmek için yayma yeterlidir: `[...a, still(500), ...b]`.

### effects

| Fonksiyon | Açıklama |
|---|---|
| `wave(src, n, delay, along, { wavelength?, lift? })` | Görüntüyü bayrak gibi dalgalandırır. `along(x)`: sütunun gönderden uzaklığı, `null` = sabit sütun |
| `pushUp(from, to, offsets?, delay?)` | Dikey itme geçişi. Yalnızca ara kareleri döndürür |
| `scrollLeft(sample, period, delay)` | `period` genişliğindeki deseni sola sonsuz kaydırır (`period` kare, dikişsiz) |

### color ve sprites

`scale(c, k)` parlaklık, `mix(a, b, k)` karışım, `hsv(h, s, v)` gökkuşağı, `rng(seed)` belirleyici rastgele,
`BLACK`, `WHITE`. Desenler: `HEART` (7×6), `HEART_BIG` (13×11), `CHEVRON` (4×7, sağa), `flipX`, `mirrorRows`.

### Arayüzden kullanım

```ts
import { PRESETS, PRESET_TAGS, getPreset, presetFrames, presets } from '../core/animations'
presetFrames('dragon-eyes')            // önbellekli kareler (değiştirme, gerekirse cloneFrames)
presetFrames(getPreset('heart'), rgb)  // kullanıcı rengiyle
presets.byTag('signal')                // etiket filtresi
```

## 5. Şablonlar

### a) Simülasyon/parçacık (`sequence` + `rng`)

```ts
export const sparks = definePreset({
  id: 'sparks',
  name: { tr: 'Kıvılcımlar', en: 'Sparks' },
  tags: ['party'],
  color: [255, 180, 40],
  make: (c) => {
    const r = rng(42)                                   // sabit tohum: her üretimde aynı GIF
    const ps = Array.from({ length: 20 }, () => ({ x: r() * W, y: r() * H, v: 0.3 + r() * 0.5 }))
    return sequence(30, 60, (g, i) =>
      ps.forEach((p) => g.set(p.x, (p.y + i * p.v) % H, scale(c, 0.4 + 0.6 * ((i + p.x) % 3) / 2))),
    )
  },
})
```

### b) Poz tablosu (`steps`): karakter, yüz, sahne

Davranışı veriyle, çizimi fonksiyonla tanımla. Örnek: [`faces.ts` → `dragon-eyes`](../app/src/core/animations/presets/faces.ts).

```ts
interface Pose { ms: number; open: number; gaze: number }
const CALM = { open: 1, gaze: 0 }
const TIMELINE: Pose[] = [
  { ms: 800 },
  { ms: 150, gaze: -3 }, { ms: 600, gaze: -3 },
  { ms: 90, open: 0.3 }, { ms: 90, open: 0 }, { ms: 90, open: 0.3 },   // göz kırpma
].map((p) => ({ ...CALM, ...p }))

function drawFace(g: Canvas, p: Pose, c: RGB) { /* yalnızca çizim, zamanlama yok */ }

make: (c) => steps(TIMELINE, (p) => p.ms, (g, p) => drawFace(g, p, c))
```

### c) Desen/ikon (`sprite`)

```ts
const ROCKET: Sprite = ['..#..', '.###.', '.#o#.', '.###.', '#####', '#.#.#']
make: (c) => sequence(16, 70, (g, i) =>
  g.sprite(ROCKET, 21, 12 - i, (ch) => (ch === 'o' ? [120, 200, 255] : c)),   // karaktere göre renk
)
```

### d) Sabit görüntü + hazır efekt

```ts
make: () => {
  const img = still(0, (g) => { g.fill([0, 40, 120]); g.text('HELLO', 6, WHITE) })
  return wave(img, 16, 80, (x) => x)            // ya da scrollLeft / pushUp
}
```

## 6. Önizleme ve test

Panele göndermeden önce animasyonu gör:

```bash
cd app
PRESET=dragon-eyes npm run preview:preset                          # bash
$env:PRESET='dragon-eyes'; npm run preview:preset                  # PowerShell
PRESET=dragon-eyes PRESET_FRAMES=0,13,20 npm run preview:preset    # yalnızca seçili kareler ("0-5" de olur)
PRESET=heart PRESET_COLOR=00ff80 npm run preview:preset            # renk seçici değeriyle
PRESET=all npm run preview:preset                                  # hepsi
```

Çıktılar:

- **stdout:** özet (kare sayısı, döngü süresi, GIF baytı) ve renk lejantlı ASCII kareler. Her renk bir harftir,
  `.` kapalı LED'dir. Lejant RGB değerlerini verir. Metin okuyan bir asistan şekli buradan denetleyebilir.
- **`logs/preview/<kimlik>.png`:** LED görünümlü kare tablosu. Görsel okuyabilen bir asistan bu dosyayı açıp
  bakmalı. Renk ve oran hatalarını ASCII'den çok daha iyi gösterir.
- **`logs/preview/<kimlik>.gif`:** panele gidecek GIF'in aynısı. Panelde denemek için:
  `python tools/slq_cli.py gif logs/preview/<kimlik>.gif` (proje kökünden).

`logs/` depoya girmez.

Testler:

```bash
npm run typecheck
npm test
```

[`presets.test.ts`](../app/src/core/animations/presets.test.ts) CATALOG'daki her animasyon için şunları denetler:
meta veri (tr/en ad, geçerli etiket), 1..80 kare, 48×12, süre ≥ 20 ms, belirleyicilik, en az bir piksel yanıyor,
renk seçici işe yarıyor, geçerli GIF < 40 KB. Kimlik kebab-case değilse ya da iki kez kullanılmışsa
`PresetRegistry` uygulama açılırken hata verir.

## 7. Kontrol listesi

- [ ] `id` kebab-case, benzersiz. `name.tr` ve `name.en` dolu. `tags` uygun.
- [ ] Rastgelelik yalnızca `rng(seed)` ile.
- [ ] `color` verildiyse `make` bu rengi kullanıyor. Verilmediyse `make: () => …`.
- [ ] Döngü dikişsiz: son kare ilk kareye yumuşak bağlanıyor.
- [ ] Kare sayısı ≤ 80, GIF birkaç KB (≤ 40 KB).
- [ ] Ara ton/kenar yumuşatma yok. Kare başına renk sayısı makul (≤ 64 ideal).
- [ ] `CATALOG`'a eklendi. Arayüzde başka değişiklik yapılmadı.
- [ ] Önizleme PNG'sine bakıldı. `npm run typecheck` ve `npm test` temiz.
- [ ] Mümkünse panelde denendi (uygulama: Görseller → Galeri → gönder, ya da CLI).
- [ ] [docs/app.md](app.md) içindeki animasyon sayısı/listesi güncellendi.

## 8. Sık yapılan hatalar

| Hata | Sonuç | Doğrusu |
|---|---|---|
| `presetFrames()` dönüşünü değiştirmek | Önbellekteki kareler bozulur, galeri yanlış görünür | Düzenlemek için `cloneFrames(frames)` |
| Mevcut önayarın `id`'sini değiştirmek | Kullanıcı seçimleri ve önbellek kopar | Yeni kimlikle yeni önayar ekle |
| Ondalık koordinatlarla ince çizgi | Yuvarlama yüzünden kesikli çizgi | Satır/sütun bazında tamsayı hesapla ya da kalın (2 px) çiz |
| Var olan bir animasyonu yeniden düzenlerken çıktıyı değiştirmek | Paneldeki GIF CRC'si değişir | Refaktörden önce ve sonra kare/GIF özetlerini karşılaştır (bayt bayt aynı olmalı) |
| `Math.random()` | Her açılışta farklı GIF | `rng(seed)` |
| Önizlemede `COLOR=` kullanmak | vitest `COLOR=0` ayarlar, renk bozulur | `PRESET_COLOR=` |
