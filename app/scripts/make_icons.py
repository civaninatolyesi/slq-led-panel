#!/usr/bin/env python3
"""Uygulama simgelerini üretir (masaüstü, PWA, Android). Çalıştırma: python app/scripts/make_icons.py"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

APP = Path(__file__).resolve().parents[1]
S = 1024


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def icon(size: int = S, padded: bool = True) -> Image.Image:
    """Mor→camgöbeği gradyan zemin üzerinde parlayan 3x3 LED ızgarası."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGB", (S, S))
    px = grad.load()
    c0, c1, c2 = (139, 92, 246), (99, 102, 241), (34, 211, 238)
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            px[x, y] = lerp(c0, c1, t / 0.45) if t < 0.45 else lerp(c1, c2, (t - 0.45) / 0.55)
    m = 92 if padded else 0
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((m, m, S - m, S - m), radius=(S - 2 * m) * 0.23, fill=255)
    img.paste(grad, (0, 0), mask)

    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dots = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd, dd = ImageDraw.Draw(glow), ImageDraw.Draw(dots)
    step = (S - 2 * m) * 0.27
    cx0 = S / 2 - step
    for gy in range(3):
        for gx in range(3):
            big = (gx + gy) % 2 == 0
            r = step * (0.24 if big else 0.17)
            a = 255 if big else 160
            x, y = cx0 + gx * step, cx0 + gy * step
            gd.ellipse((x - r * 1.6, y - r * 1.6, x + r * 1.6, y + r * 1.6), fill=(255, 255, 255, 90))
            dd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, a))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.025)))
    img.alpha_composite(dots)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    (APP / "build").mkdir(exist_ok=True)
    (APP / "public").mkdir(exist_ok=True)
    big = icon(1024)
    big.save(APP / "build" / "icon.png")
    big.resize((256, 256), Image.Resampling.LANCZOS).save(APP / "build" / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    for s in (192, 512):
        icon(s).save(APP / "public" / f"icon-{s}.png")
    # maskable: tam dolu zemin (Android uyarlanabilir simge kırpması için)
    icon(512, padded=False).save(APP / "public" / "icon-maskable-512.png")

    # Android başlatıcı simgeleri (Capacitor projesi varsa)
    res = APP / "android" / "app" / "src" / "main" / "res"
    if res.exists():
        dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
        full = icon(1024, padded=False)
        for d, s in dens.items():
            folder = res / f"mipmap-{d}"
            folder.mkdir(exist_ok=True)
            icon(s).save(folder / "ic_launcher.png")
            icon(s).save(folder / "ic_launcher_round.png")
            # uyarlanabilir simge ön planı: 108dp tuvalin ortadaki 72dp'si görünür
            fg = Image.new("RGBA", (s * 108 // 48,) * 2, (0, 0, 0, 0))
            inner = full.resize((s * 72 // 48,) * 2, Image.Resampling.LANCZOS)
            fg.paste(inner, ((fg.width - inner.width) // 2,) * 2)
            fg.save(folder / "ic_launcher_foreground.png")
    print("simgeler üretildi")


if __name__ == "__main__":
    main()
