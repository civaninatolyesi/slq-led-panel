"""
Panel bağlantısı (bleak): notify kuyruğu, kopmada yeniden bağlanma, komut ve transfer akışları.
Akışların tarifi: docs/protocol/04-transfers.md

Güvenlik: bu modül AE01'e (JieLi OTA) yazma yolu sunmaz.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakError

from . import protocol as P
from .text import encode_text

TEST_DEVICE = "71:85:ED:B5:55:F7"   # SLQ-B555F7, geliştirme paneli
CHARS = {"cmd": P.CMD_CHAR, "data": P.DATA_CHAR}


# ---------------------------------------------------------------- log
class EventLog:
    """Konsol + logs/<run>_<tag>.txt + logs/events.jsonl (makine okunur)."""

    def __init__(self, tag: str, log_dir: Path | str = "logs", echo: bool = True) -> None:
        self.dir = Path(log_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.run = time.strftime("%Y%m%d_%H%M%S")
        self.txt = open(self.dir / f"{self.run}_{tag}.txt", "a", encoding="utf-8")
        self.jsonl = open(self.dir / "events.jsonl", "a", encoding="utf-8")
        self.echo = echo
        self.exp: str | None = None

    def ev(self, kind: str, msg: str, quiet: bool = False, **fields) -> None:
        t = time.time()
        line = f"{time.strftime('%H:%M:%S', time.localtime(t))}.{int(t * 1000) % 1000:03d} " \
               f"{f'[{self.exp}] ' if self.exp else ''}{msg}"
        if not quiet:
            if self.echo:
                print(line, flush=True)
            self.txt.write(line + "\n")
            self.txt.flush()
        self.jsonl.write(json.dumps({"t": round(t, 3), "run": self.run, "exp": self.exp, "kind": kind, **fields},
                                    ensure_ascii=False) + "\n")
        self.jsonl.flush()

    def set_exp(self, name: str) -> None:
        self.exp = name
        self.ev("exp", f"=== {name}", name=name)


# ---------------------------------------------------------------- tarama
@dataclass
class Found:
    name: str
    address: str
    rssi: int
    mfr: bytes

    @property
    def version(self) -> str:
        """Advertising'deki sürüm (uygulamanın BleConfig.getLedVersionName karşılığı)."""
        return f"1.0.{self.mfr[9]}" if len(self.mfr) > 9 else "?"


async def scan(timeout: float = 6.0) -> list[Found]:
    out = []
    found = await BleakScanner.discover(timeout=timeout, return_adv=True)
    for dev, adv in found.values():
        mfr = adv.manufacturer_data.get(P.MFR_ID, b"")
        name = adv.local_name or dev.name or ""
        if name.startswith(P.NAME_PREFIX) or mfr[:3] == P.ADV_SIGNATURE:
            out.append(Found(name, dev.address, adv.rssi, bytes(mfr)))
    return sorted(out, key=lambda f: -f.rssi)


# ---------------------------------------------------------------- panel
class LinkDead(Exception):
    pass


@dataclass
class TransferResult:
    ok: bool
    chunks: int = 0
    detail: str = ""


class Panel:
    """Tek panel bağlantısı. on_tx(char, data) / on_rx(data) arayüzler için kancalardır."""

    def __init__(self, addr: str = TEST_DEVICE, log: EventLog | None = None,
                 on_tx: Callable[[str, bytes], None] | None = None,
                 on_rx: Callable[[bytes], None] | None = None, attempts: int = 8) -> None:
        self.addr = addr
        self.log = log or EventLog("panel")
        self.on_tx, self.on_rx = on_tx, on_rx
        self.attempts = attempts
        self.client: BleakClient | None = None
        self.q: asyncio.Queue[bytes] = asyncio.Queue()
        self.ready = asyncio.Event()
        self.lost = asyncio.Event()
        self.dead = self.closing = False
        self.seq = 0
        self._watchdog: asyncio.Task | None = None

    # -- bağlantı
    async def connect(self) -> None:
        self.loop = asyncio.get_running_loop()
        await self._connect_loop()
        if self.dead:
            raise LinkDead(f"{self.addr} bağlanılamadı")
        self._watchdog = asyncio.create_task(self._watch())

    async def close(self) -> None:
        self.closing = True
        if self._watchdog:
            self._watchdog.cancel()
        if self.client and self.client.is_connected:
            await self.client.disconnect()

    async def __aenter__(self) -> "Panel":
        await self.connect()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    async def _connect_loop(self) -> None:
        delay = 1.0
        for n in range(1, self.attempts + 1):
            try:
                c = BleakClient(self.addr, disconnected_callback=self._on_disc, timeout=15)
                await c.connect()
                self.client = c
                self.log.ev("connect", f"bağlandı {self.addr} mtu={c.mtu_size} (deneme {n})",
                            addr=self.addr, mtu=c.mtu_size)
                await c.start_notify(P.NOTIFY_CHAR, self._notify)
                self.ready.set()
                return
            except (BleakError, asyncio.TimeoutError, OSError) as e:
                self.log.ev("connect_fail", f"bağlantı denemesi {n}/{self.attempts}: {e}", error=str(e))
                await asyncio.sleep(delay)
                delay = min(delay * 2, 10.0)
        self.dead = True
        self.log.ev("dead", f"{self.attempts} denemede bağlanılamadı")
        self.ready.set()

    def _on_disc(self, client: BleakClient) -> None:
        if client is self.client and not self.closing:
            self.loop.call_soon_threadsafe(self._mark_lost)

    def _mark_lost(self) -> None:
        if not self.lost.is_set():
            self.log.ev("disconnect", "BAĞLANTI KOPTU")
            self.ready.clear()
            self.lost.set()

    async def _watch(self) -> None:
        while not self.closing:
            await self.lost.wait()
            self.log.ev("reconnect", "yeniden bağlanılıyor...")
            await self._connect_loop()
            self.lost.clear()
            if self.dead:
                return

    def _notify(self, _sender, data: bytearray) -> None:
        data = bytes(data)
        self.log.ev("notify", f"<< c823 {data.hex(' ')}", char="c823", data=data.hex())
        if self.on_rx:
            self.on_rx(data)
        self.loop.call_soon_threadsafe(self.q.put_nowait, data)

    # -- düşük seviye
    async def write(self, char: str, data: bytes) -> bool:
        """char: 'cmd' (C821) | 'data' (C822). Cevaplı yazma kullanılır."""
        await asyncio.wait_for(self.ready.wait(), timeout=self.attempts * 25)
        if self.dead:
            raise LinkDead(self.addr)
        self.seq += 1
        self.log.ev("write", f">> #{self.seq} {char} {data.hex(' ')}", seq=self.seq, char=char, data=data.hex())
        if self.on_tx:
            self.on_tx(char, data)
        try:
            await self.client.write_gatt_char(CHARS[char], data, response=True)
            return True
        except Exception as e:  # noqa: BLE001
            self.log.ev("write_error", f"#{self.seq} yazma hatası: {e}", seq=self.seq, error=str(e))
            return False

    def drain(self) -> None:
        while not self.q.empty():
            self.q.get_nowait()

    async def collect(self, seconds: float) -> list[bytes]:
        got, end = [], time.monotonic() + seconds
        while (left := end - time.monotonic()) > 0:
            try:
                got.append(await asyncio.wait_for(self.q.get(), left))
            except asyncio.TimeoutError:
                break
        return got

    async def wait_for(self, pred: Callable[[bytes], bool], seconds: float = 3.0) -> bytes | None:
        end = time.monotonic() + seconds
        while (left := end - time.monotonic()) > 0:
            try:
                d = await asyncio.wait_for(self.q.get(), left)
            except asyncio.TimeoutError:
                return None
            if pred(d):
                return d
        return None

    async def command(self, data: bytes, wait: float = 0.4) -> list[P.Response]:
        """C821'e hazır çerçeve yazar, `wait` saniye boyunca gelen cevapları döndürür."""
        self.drain()
        await self.write("cmd", data)
        return [r for r in map(P.parse_response, await self.collect(wait)) if r]

    # -- transfer
    async def transfer(self, start: bytes, header: bytes, data: bytes, force: bool = False) -> TransferResult:
        """Başlat (C821) -> CMD SUB 01 01 -> parçalar (C822, her biri ACK) -> transfer_done -> 01 02 03 01 CMD SUB"""
        cmd, sub = start[0], start[1]
        self.drain()
        await self.write("cmd", start)
        go = await self.wait_for(lambda d: d[0] == cmd and d[1] == sub and len(d) > 3, 4)
        if go is None and not force:
            return TransferResult(False, detail="başlat komutuna cevap gelmedi")
        if go is not None and go[3] == P.Status.SAME:
            return TransferResult(True, detail="aynı veri panelde zaten var")
        if go is not None and go[3] != P.Status.OK:
            return TransferResult(False, detail=f"başlat reddedildi: {go.hex(' ')}")
        parts = P.chunks(header, data)
        for i, part in enumerate(parts):
            await self.write("data", part)
            ack = await self.wait_for(lambda d: len(d) >= 4 and d[0] == 1, 4)
            if ack is None:
                return TransferResult(False, i, f"parça {i + 1}/{len(parts)} ACK gelmedi")
            if ack[1] == 2 and ack[3] > 1:
                return TransferResult(False, i, f"panel veri hatası: {ack.hex(' ')}")
        await self.write("cmd", P.transfer_done())
        end = await self.wait_for(lambda d: len(d) >= 4 and d[0] == 1 and d[1] == 2, 4)
        if end is None:
            return TransferResult(False, len(parts), "bitiş cevabı gelmedi")
        return TransferResult(end[3] == P.Status.OK, len(parts), f"{len(data)} byte, bitiş {end.hex(' ')}")

    # -- yüksek seviye
    async def send_text(self, text: str, rgb=(255, 0, 0), mode: str = "mixed", **style) -> TransferResult:
        """style: index, effect, speed, color_index, bg_index, bg_rgb, orientation (protocol.text_start)."""
        data = encode_text(text, rgb, mode)
        return await self.transfer(P.text_start(data, **style), P.TEXT_CHUNK_HEADER, data)

    async def send_gif(self, gif: bytes, index: int = 0) -> TransferResult:
        return await self.transfer(P.image_start(gif, index), P.IMAGE_CHUNK_HEADER, gif)

    async def send_playlist(self, gifs: list[bytes]) -> TransferResult:
        self.drain()
        await self.write("cmd", P.playlist_begin(len(gifs)))
        if await self.wait_for(lambda d: d[:2] == b"\x0a\x01" and len(d) > 3 and d[3] == 1, 4) is None:
            return TransferResult(False, detail="playlist başlatma cevabı gelmedi")
        for i, g in enumerate(gifs, 1):
            r = await self.send_gif(g, index=i)
            if not r.ok:
                return TransferResult(False, i, f"öğe {i}: {r.detail}")
            await asyncio.sleep(0.1)
        return TransferResult(True, len(gifs))

    async def query_info(self) -> P.Response | None:
        rs = await self.command(P.query_info(), wait=1.0)
        return next((r for r in rs if r.is_(0x5A, 0x01)), None)
