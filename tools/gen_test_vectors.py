#!/usr/bin/env python3
"""
Python referans istemcisinden test vektörleri üretir. SLQ Studio'nun (app/) TypeScript protokol portu
bu vektörlerle birebir karşılaştırılır: app/src/core/protocol.test.ts

    python tools/gen_test_vectors.py        # app/src/core/vectors.json dosyasını yeniler
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from slq import protocol as P  # noqa: E402
from slq.text import encode_text, font_std, font_table  # noqa: E402

NOW = datetime(2026, 11, 2, 21, 7, 9)


def h(b: bytes) -> str:
    return b.hex()


def main() -> None:
    text_data = encode_text("HELLO12", (255, 128, 0), "mixed")   # boşluksuz: boşluk Python'da TİP 4
    gif = bytes(range(256)) * 4                                  # parçalama için 1024 baytlık sahte veri
    v = {
        "crc16_123456789": h(P.crc16(b"123456789")),
        "crc32c_123456789": h(P.crc32c(b"123456789")),
        "frames": {
            "query_info": h(P.query_info()),
            "brightness_10": h(P.brightness(10)),
            "brightness_0": h(P.brightness(0)),
            "power_on": h(P.power(True)),
            "power_off": h(P.power(False)),
            "rotate_on": h(P.rotate_180(True)),
            "text_style": h(P.text_style(P.Effect.LEFT, 60, 3, (255, 0, 0), 0, (0, 0, 64), 1)),
            "graffiti_new": h(P.graffiti(P.GraffitiMode.NEW)),
            "pixel": h(P.pixel(47, 11, (1, 2, 3), P.PixelMode.MIRROR_H)),
            "rhythm": h(P.rhythm(2, list(range(12)))),
            "rhythm_off": h(P.rhythm_off()),
            "bike_signal_right": h(P.bike_signal(P.BikeSignal.RIGHT)),
            "bike_speed_25_5": h(P.bike_speed(25.5)),
            "bike_speed_mph": h(P.bike_speed(12.3, mph=True)),
            "playlist_begin_3": h(P.playlist_begin(3)),
            "playlist_clear": h(P.playlist_clear()),
            "clock_2": h(P.clock(2, z=1, z2=0, now=NOW)),
            "schedule_off": h(P.schedule(None, (23, 30), now=NOW)),
            "schedule_both": h(P.schedule((7, 5), (23, 30), now=NOW)),
            "schedule_none": h(P.schedule(None, None, now=NOW)),
            "reset": h(P.reset()),
            "sync": h(P.sync()),
            "transfer_done": h(P.transfer_done()),
            "text_start": h(P.text_start(text_data, index=2, effect=P.Effect.LASER, speed=55, color_index=3,
                                         bg_rgb=(1, 2, 3), orientation=1)),
            "image_start": h(P.image_start(gif, 4)),
        },
        "text_HELLO12_mixed": h(text_data),
        "font_std": {ch: h(font_std(g)) for ch, g in font_table().items()},
        "chunks_image_1024": [h(c) for c in P.chunks(P.IMAGE_CHUNK_HEADER, gif)],
    }
    out = ROOT / "app" / "src" / "core" / "vectors.json"
    out.write_text(json.dumps(v, indent=1), encoding="utf-8")
    print(f"{out.relative_to(ROOT)}: {len(v['frames'])} çerçeve, {len(v['font_std'])} glif")


if __name__ == "__main__":
    main()
