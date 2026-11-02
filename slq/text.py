"""
Metin verisi kodlama (text_start ile gönderilen içerik). Biçim: docs/protocol/05-data-formats.md

Her karakter: TİP | R G B | GLİF
  TİP 3 -> yerleşik 6x12 font, 12 byte  (ekrana 8 karakter sığar)
  TİP 4 -> 12x12 bitmap, 24 byte        (ekrana 4 karakter sığar; her karakter için çalışır)
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_FILE = Path(__file__).with_name("data") / "font12.json"
GLYPH_FONT = 3
GLYPH_BITMAP = 4


@lru_cache(maxsize=1)
def font_table() -> dict[str, list[int]]:
    """Uygulamanın Text12.get_X() tablosu (91 karakter), HAM biçimde."""
    return json.loads(FONT_FILE.read_text(encoding="utf-8"))


def font_std(raw: list[int]) -> bytes:
    """Text12.convertToStandardFormat karşılığı. Ham tablo panelde bozuk görünür; bu dönüşüm şarttır.
    Ham: byte0..5 = sütunların üst 8 satırı (bit7 = satır 0), byte6..11 bit6..3 = satır 8..11.
    Çıktı: sütun başına 2 byte [üst, alt], bit7 = en üst satır."""
    out = bytearray()
    for c in range(6):
        top = bot = 0
        for r in range(8):
            if (raw[c] >> r) & 1:
                top |= 0x80 >> (7 - r)
        for r in range(4):
            if (raw[c + 6] >> (6 - r)) & 1:
                bot |= 0x80 >> r
        out += bytes([top, bot])
    return bytes(out)


def glyph_bitmap(ch: str, font_path: str = "arial.ttf", size: int = 11) -> bytes:
    """Karakteri 12x12 çizip TİP 4 biçimine çevirir: sütun başına 2 byte, bit7 = en üst satır."""
    img = Image.new("1", (12, 12), 0)
    try:
        font = ImageFont.truetype(font_path, size)
    except OSError:
        font = ImageFont.load_default()
    ImageDraw.Draw(img).text((6, 6), ch, fill=1, font=font, anchor="mm")
    out = bytearray()
    for x in range(12):
        b0 = b1 = 0
        for y in range(12):
            if img.getpixel((x, y)):
                if y < 8:
                    b0 |= 0x80 >> y
                else:
                    b1 |= 0x80 >> (y - 8)
        out += bytes([b0, b1])
    return bytes(out)


def encode_text(s: str, rgb: tuple[int, int, int] = (255, 0, 0), mode: str = "mixed") -> bytes:
    """mode:
    'mixed'  -> tablodaki karakterler TİP 3 (dar), diğerleri TİP 4 (önerilen, doğrulandı)
    'bitmap' -> her karakter TİP 4 (doğrulandı)
    'raw'    -> TİP 3 ham tablo (panelde BOZUK görünür; yalnızca karşılaştırma için)"""
    table = font_table()
    out = bytearray()
    for ch in s:
        if mode != "bitmap" and ch in table:
            g = table[ch]
            out += bytes([GLYPH_FONT, *rgb]) + (bytes(g) if mode == "raw" else font_std(g))
        else:
            out += bytes([GLYPH_BITMAP, *rgb]) + glyph_bitmap(ch)
    return bytes(out)
