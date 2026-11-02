"""
Resim/animasyon verisi: panel ham GIF dosyası alır ve kendisi çözer (48x12).
Firmware GIF'e ayrıca efekt uygulamaz; hareket karelerin içine çizilmelidir.
"""
from __future__ import annotations

import io

from PIL import Image

from .protocol import PANEL_H, PANEL_W


def encode_gif(frames: list[Image.Image], duration_ms: int = 150, colors: int = 16) -> bytes:
    """Kareleri 48x12 GIF'e çevirir. Pillow'un delta kareli (kırpılmış) GIF'i panelde doğrulandı."""
    if not frames:
        raise ValueError("en az bir kare gerekli")
    pal = []
    for f in frames:
        if f.size != (PANEL_W, PANEL_H):
            f = f.resize((PANEL_W, PANEL_H), Image.Resampling.NEAREST)
        pal.append(f.convert("RGB").quantize(colors=colors))
    buf = io.BytesIO()
    if len(pal) == 1:
        pal[0].save(buf, format="GIF")
    else:
        pal[0].save(buf, format="GIF", save_all=True, append_images=pal[1:],
                    duration=duration_ms, loop=0, optimize=False)
    return buf.getvalue()


def solid(rgb: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (PANEL_W, PANEL_H), rgb)
