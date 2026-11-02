#!/usr/bin/env python3
"""
SLQ panel komut satırı aracı. Rehber: docs/development.md#komut-satırı-aracı

Örnekler (proje kökünden):
    python tools/slq_cli.py scan
    python tools/slq_cli.py info
    python tools/slq_cli.py brightness 40
    python tools/slq_cli.py text "MERHABA" --color ff8000 --effect LEFT
    python tools/slq_cli.py gif animasyon.gif
    python tools/slq_cli.py clock --style 2
    python tools/slq_cli.py schedule --off 23:30        # her gün 23:30'da kapan
    python tools/slq_cli.py cmd 00 01 01 32             # CRC16 otomatik eklenir
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from slq import EventLog, Panel, encode_gif, scan  # noqa: E402
from slq import protocol as P  # noqa: E402
from slq.ble import TEST_DEVICE  # noqa: E402


def rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def hhmm(s: str) -> tuple[int, int]:
    h, m = s.split(":")
    return int(h), int(m)


def load_gif(path: str) -> bytes:
    """48x12 GIF'i olduğu gibi gönderir; diğer boyut/biçimleri 48x12 GIF'e çevirir."""
    im = Image.open(path)
    if im.format == "GIF" and im.size == (P.PANEL_W, P.PANEL_H):
        return Path(path).read_bytes()
    frames = [f.convert("RGB") for f in ImageSequence.Iterator(im)]
    return encode_gif(frames, im.info.get("duration", 150))


async def run(a) -> None:
    if a.cmd == "scan":
        for f in await scan(a.timeout):
            print(f"{f.name:12} {f.address}  rssi={f.rssi:4}  sürüm={f.version}  mfr={f.mfr.hex(' ')}")
        return
    log = EventLog("cli", ROOT / "logs", echo=a.verbose)
    async with Panel(a.addr, log) as p:
        if a.cmd == "info":
            r = await p.query_info()
            print("cevap yok" if r is None else f"payload={r.payload.hex(' ')}  şifre={'var' if r.payload[2] else 'yok'}")
        elif a.cmd == "brightness":
            await p.command(P.brightness(a.level))
        elif a.cmd == "power":
            await p.command(P.power(a.state == "on"))
        elif a.cmd == "rotate":
            await p.command(P.rotate_180(a.state == "on"))
        elif a.cmd == "text":
            r = await p.send_text(a.text, rgb(a.color), a.mode, effect=P.Effect[a.effect], speed=a.speed,
                                  bg_rgb=rgb(a.bg))
            print("tamam" if r.ok else "HATA", r.detail)
        elif a.cmd == "gif":
            r = await p.send_gif(load_gif(a.file))
            print("tamam" if r.ok else "HATA", r.detail)
        elif a.cmd == "clock":
            await p.command(P.clock(a.style))
        elif a.cmd == "schedule":
            await p.command(P.schedule(on=hhmm(a.on) if a.on else None, off=hhmm(a.off) if a.off else None))
        elif a.cmd == "playlist-clear":
            await p.command(P.playlist_clear())
        elif a.cmd == "cmd":
            for r in await p.command(P.with_crc(*bytes.fromhex("".join(a.hex))), wait=1.0):
                print(f"cevap: {r.raw.hex(' ')}  status={r.status}")


def main() -> None:
    ap = argparse.ArgumentParser(description="SLQ LED panel aracı")
    ap.add_argument("--addr", default=TEST_DEVICE)
    ap.add_argument("-v", "--verbose", action="store_true", help="BLE trafiğini ekrana yaz")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("scan").add_argument("--timeout", type=float, default=6.0)
    sub.add_parser("info")
    sub.add_parser("brightness").add_argument("level", type=int)
    sub.add_parser("power").add_argument("state", choices=["on", "off"])
    sub.add_parser("rotate").add_argument("state", choices=["on", "off"])
    t = sub.add_parser("text")
    t.add_argument("text")
    t.add_argument("--color", default="ff0000")
    t.add_argument("--bg", default="000000")
    t.add_argument("--effect", default="FIXED", choices=[e.name for e in P.Effect])
    t.add_argument("--speed", type=int, default=100)
    t.add_argument("--mode", default="mixed", choices=["mixed", "bitmap"])
    sub.add_parser("gif").add_argument("file")
    sub.add_parser("clock").add_argument("--style", type=int, default=1, choices=range(4))
    s = sub.add_parser("schedule", help="parametresiz: zamanlayıcıyı kapat")
    s.add_argument("--on", help="HH:MM her gün aç")
    s.add_argument("--off", help="HH:MM her gün kapat")
    sub.add_parser("playlist-clear")
    sub.add_parser("cmd", help="C821'e ham komut (CRC otomatik)").add_argument("hex", nargs="+")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
