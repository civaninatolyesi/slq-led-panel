#!/usr/bin/env python3
"""
SLQ doğrulama paketi: her protokol özelliğini panelde sırayla dener, gözlemci tarayıcıdan
"oldu / olmadı / kısmen" cevabı verir. Rehber: docs/development.md#doğrulama-paketi

Kullanım (proje kökünden):
    python tools/slq_test.py [--addr AA:BB:..] [--from <test_id>] [--port 8766]
    -> http://localhost:8766

Sonuçlar logs/test_results.jsonl dosyasına eklenir; yeniden başlatınca önceki cevaplar listede görünür.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import sys
import threading
import time
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from slq import EventLog, LinkDead, Panel, encode_gif, solid  # noqa: E402
from slq import protocol as P  # noqa: E402

LOG_DIR = ROOT / "logs"
RESULTS = LOG_DIR / "test_results.jsonl"
PAGE = (Path(__file__).with_name("slq_test.html")).read_text(encoding="utf-8")
W, H = P.PANEL_W, P.PANEL_H


# ---------------------------------------------------------------- test görselleri
def img_bars() -> Image.Image:
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for i, rgb in enumerate([(255, 0, 0), (0, 255, 0), (0, 0, 255)]):
        d.rectangle([i * 16, 0, i * 16 + 15, H - 1], fill=rgb)
    return im


def img_arrow() -> Image.Image:
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    d.rectangle([2, 4, 30, 7], fill=(255, 255, 0))
    d.polygon([(30, 0), (45, 5), (30, 11)], fill=(255, 255, 0))
    return im


def frames_moving_bar() -> list[Image.Image]:
    out = []
    for x in range(0, W, 4):
        im = Image.new("RGB", (W, H))
        ImageDraw.Draw(im).rectangle([x, 0, x + 3, H - 1], fill=(255, 255, 255))
        out.append(im)
    return out


# ---------------------------------------------------------------- arayüz durumu
class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.tests: list[dict] = []
        self.cur = -1
        self.phase = "bağlanıyor"
        self.msg = ""
        self.sent: list[str] = []
        self.recv: list[str] = []
        self.connected = False

    def snap(self) -> dict:
        with self.lock:
            return {"tests": self.tests, "cur": self.cur, "phase": self.phase, "msg": self.msg,
                    "sent": self.sent[-40:], "recv": self.recv[-40:], "connected": self.connected}


S = State()


def note(msg: str) -> None:
    with S.lock:
        S.msg = msg


def on_tx(char: str, data: bytes) -> None:
    with S.lock:
        S.sent.append(f"{time.strftime('%H:%M:%S')}  {char}  {data.hex(' ')}")


def on_rx(data: bytes) -> None:
    with S.lock:
        S.recv.append(f"{time.strftime('%H:%M:%S')}  c823  {data.hex(' ')}")


async def transfer(c: Panel, coro) -> None:
    r = await coro
    note(("✔ " if r.ok else "✘ ") + r.detail)


# ---------------------------------------------------------------- testler
TESTS: list[dict] = []


def test(tid: str, title: str, expect: str, after=None, describe: bool = False):
    def deco(fn):
        TESTS.append({"id": tid, "title": title, "expect": expect, "run": fn, "after": after, "describe": describe})
        return fn
    return deco


# --- temel
@test("sifre", "Bilgi/şifre sorgusu (5A)", "Panelde değişiklik olmamalı. Sağda '5a 01 0b …' cevabı varsa Oldu.")
async def _(c):
    await c.command(P.query_info())


@test("parlaklik_30", "Parlaklık %30 (00 01)", "Panel belirgin şekilde kararmalı (ama kapanmamalı).")
async def _(c):
    await c.command(P.brightness(30))


@test("parlaklik_100", "Parlaklık %100 (00 01)", "Panel tam parlaklığa dönmeli.")
async def _(c):
    await c.command(P.brightness(100))


@test("ekran_kapat", "Ekranı kapat (00 03)", "Panel tamamen sönmeli.")
async def _(c):
    await c.command(P.power(False))


@test("ekran_ac", "Ekranı aç (00 03)", "Panel geri yanmalı, önceki içerik görünmeli.")
async def _(c):
    await c.command(P.power(True))


# --- metin
@test("metin_font", "Metin: HELLO (TİP 4 bitmap)", "Kırmızı HELLO. 4 karakter sığar: önce 'HELL', sonra 'O'.")
async def _(c):
    await transfer(c, c.send_text("HELLO", (255, 0, 0), mode="bitmap"))


@test("metin_bitmap", "Metin: ÇĞŞ12 (TİP 4 bitmap)", "Yeşil 'ÇĞŞ1' sonra '2'. Türkçe harfler okunaklı.")
async def _(c):
    await transfer(c, c.send_text("ÇĞŞ12", (0, 255, 0), mode="bitmap"))


@test("metin_font_std", "Metin: HELLO 12 (TİP 3 dar font + bitmap boşluk)", "Beyaz 'HELLO 1' sonra '2'. Harfler 6 px dar.")
async def _(c):
    await transfer(c, c.send_text("HELLO 12", (255, 255, 255), mode="mixed"))


@test("metin_uzun", "Metin: uzun yazı + sola kayma", "Mavi 'MERHABA DUNYA 2026' sola kayarak akmalı.")
async def _(c):
    await transfer(c, c.send_text("MERHABA DUNYA 2026", (0, 80, 255), mode="bitmap", effect=P.Effect.LEFT))


def _text_effect(e: P.Effect):
    async def run(c):
        await transfer(c, c.send_text("HELLO", (255, 0, 0), mode="bitmap"))
        await asyncio.sleep(0.3)
        await c.command(P.text_style(effect=e))
    return run


EFFECT_EXPECT = {1: "sola kayma", 2: "sağa kayma (karakter sırası ters görünür: OLLEH)", 3: "yukarı kayma",
                 4: "aşağı kayma", 5: "sayfa geçişi", 6: "sayfa geçişi", 7: "lazer"}
for _e in range(1, 8):
    test(f"metin_efekt_{_e}", f"Metin efekti {_e}: {P.Effect(_e).name} (54)",
         f"Kırmızı HELLO, {EFFECT_EXPECT[_e]}.")(_text_effect(P.Effect(_e)))


@test("metin_hiz", "Metin hızı 10 (54)", "HELLO sola kayıyor, belirgin YAVAŞ.")
async def _(c):
    await c.command(P.text_style(effect=P.Effect.LEFT, speed=10))


@test("metin_renk", "Metin rengi: sarı yazı, mavi zemin (54)", "Yazı sarı, arka plan mavi.")
async def _(c):
    await c.command(P.text_style(rgb=(255, 255, 0), bg_rgb=(0, 0, 255)))


@test("metin_renk_idx", "Metin rengi: hazır indeks 3 (54)", "Dikey gradyan: üst mavi, orta mor, alt kırmızı.", describe=True)
async def _(c):
    await c.command(P.text_style(color_index=3, rgb=(0, 0, 0)))


@test("metin_yon", "Metin yönü 1 (54)", "Yazı yan döner (dikey).", describe=True)
async def _(c):
    await c.command(P.text_style(orientation=1))


# --- GIF
@test("gif_statik", "GIF: kırmızı | yeşil | mavi şeritler", "Soldan sağa üç blok, her biri 16x12.")
async def _(c):
    await transfer(c, c.send_gif(encode_gif([img_bars()])))


@test("gif_anim", "GIF: hareketli beyaz çubuk", "Beyaz dikey çubuk soldan sağa kaymalı (döngü).")
async def _(c):
    await transfer(c, c.send_gif(encode_gif(frames_moving_bar(), 120)))


@test("resim_efekt_1", "NEGATİF: resim efekti (00 04 01 01 + yeni GIF)",
      "Bu firmware'de desteklenmiyor: ok SABİT kalmalı. Kayarsa Oldu, sabitse Olmadı.")
async def _(c):
    await c.command(P.with_crc(0x00, 0x04, 0x01, 0x01))
    im = img_arrow()
    im.putpixel((47, 1), (255, 0, 0))            # farklı CRC32C -> "aynı veri" cevabı gelmesin
    await transfer(c, c.send_gif(encode_gif([im])))


# --- grafiti
async def block(c: Panel, mode: P.PixelMode, x0: int, y0: int, n: int = 3, rgb=(255, 255, 255)) -> None:
    for y in range(y0, y0 + n):
        for x in range(x0, x0 + n):
            await c.command(P.pixel(x, y, rgb, mode), wait=0.03)


@test("grafiti_ciz", "Grafiti: canlı piksel (0B / 0C)",
      "Köşelerde kırmızı nokta (sol üst hariç: yeşil çizgi üstüne biner), (0,0)'dan (44,11)'e yeşil çapraz.")
async def _(c):
    await c.command(P.graffiti(P.GraffitiMode.NEW))
    for x, y in [(0, 0), (47, 0), (0, 11), (47, 11)]:
        await c.command(P.pixel(x, y, (255, 0, 0)), wait=0.05)
    for i in range(12):
        await c.command(P.pixel(i * 4, i, (0, 255, 0)), wait=0.05)


@test("grafiti_ayna_yatay", "Grafiti: yatay ayna (MIRROR_H)", "Solda çizilen 3x3 bloğun aynası sağda: 2 blok.", describe=True)
async def _(c):
    await c.command(P.graffiti(P.GraffitiMode.NEW))
    await block(c, P.PixelMode.MIRROR_H, 4, 4)


@test("grafiti_ayna_dikey", "Grafiti: dikey ayna (MIRROR_V)", "Üstte çizilen 3x3 bloğun aynası altta: 2 blok.", describe=True)
async def _(c):
    await c.command(P.graffiti(P.GraffitiMode.NEW))
    await block(c, P.PixelMode.MIRROR_V, 22, 0)


@test("grafiti_sil", "Grafiti: silgi (ERASE)", "5x5 beyaz karenin ortasında sönük bir delik.")
async def _(c):
    await c.command(P.graffiti(P.GraffitiMode.NEW))
    await block(c, P.PixelMode.DRAW, 21, 3, n=5)
    await c.command(P.pixel(23, 5, (0, 0, 0), P.PixelMode.ERASE))


@test("grafiti_cikis", "Grafiti modundan çık (0B EXIT)", "Panel önceki programa dönmeli.", describe=True)
async def _(c):
    await c.command(P.graffiti(P.GraffitiMode.EXIT))


# --- ritim
def _rhythm(style: int):
    async def run(c):
        for t in range(30):
            bands = [int(8 + 8 * math.sin(t * 0.5 + i * 0.6)) for i in range(12)]
            await c.command(P.rhythm(style, bands), wait=0.08)
    return run


for _s in range(5):
    test(f"ritim_{_s}", f"Müzik ritmi, stil {_s} (0D 01)", "~3 sn dalgalanan ekolayzır çubukları.",
         describe=True)(_rhythm(_s))


@test("ritim_kapat", "Ritmi kapat (0D 02)", "Ekolayzır kapanmalı, önceki içerik dönmeli.")
async def _(c):
    await c.command(P.rhythm_off())


# --- bisiklet
@test("bisiklet_sol", "Bisiklet: sol sinyal (10)", "Sola dönüş sinyali animasyonu.")
async def _(c):
    await c.command(P.bike_signal(P.BikeSignal.LEFT))


@test("bisiklet_sag", "Bisiklet: sağ sinyal (10)", "Sağa dönüş sinyali animasyonu.")
async def _(c):
    await c.command(P.bike_signal(P.BikeSignal.RIGHT))


@test("bisiklet_2", "Bisiklet: sürüş (10 RIDING)", "Ne göründü?", describe=True)
async def _(c):
    await c.command(P.bike_signal(P.BikeSignal.RIDING))


@test("bisiklet_hiz", "Bisiklet: hız 25.5 km/h (11)", "Panelde 25.5 hız göstergesi.", describe=True)
async def _(c):
    await c.command(P.bike_speed(25.5))


@test("bisiklet_3", "Bisiklet: durdu (11 hız 0 + 10 STOPPED)", "Ne göründü?", describe=True)
async def _(c):
    await c.command(P.bike_speed(0))
    await c.command(P.bike_signal(P.BikeSignal.STOPPED))


# --- playlist
@test("playlist", "Playlist: kırmızı + mavi (0A 01)", "Panel kırmızı ve mavi ekran arasında sırayla geçmeli.")
async def _(c):
    await transfer(c, c.send_playlist([encode_gif([solid((255, 0, 0))]), encode_gif([solid((0, 0, 255))])]))


@test("playlist_temizle", "Playlist temizle (0A 02)", "Panel fabrika demo animasyonlarına dönmeli.", describe=True)
async def _(c):
    await c.command(P.playlist_clear())


# --- kumanda (bu modelde yok)
@test("kumanda_yukle", "NEGATİF: kumanda yuvasına GIF (18 02, cevapsızsa parçalar zorla)",
      "Bu modelde desteklenmiyor: panel sessiz kalmalı, ekran değişmemeli.", describe=True)
async def _(c):
    gif = encode_gif([img_bars().transpose(Image.Transpose.FLIP_LEFT_RIGHT)])
    start = P.with_crc(0x18, 0x02, 0x06, 1, 0, *P.crc32c(gif))     # yükleme yuvası: liste sırası + 1
    await transfer(c, c.transfer(start, P.IMAGE_CHUNK_HEADER, gif, force=True))


@test("kumanda_oynat", "NEGATİF: kumanda tuşu (09 01, id 4)", "Bu modelde desteklenmiyor: değişiklik olmamalı.")
async def _(c):
    await c.command(P.with_crc(0x09, 0x01, 0x05, 0x0F, 0x01, 0xEF, 4, 1))   # oynatma: tuş id 4..14


# --- ayarlar
@test("dondur_ac", "Döndürme 180° açık (51)", "Görüntü baş aşağı.")
async def _(c):
    await transfer(c, c.send_text("HELLO", (255, 0, 0), mode="bitmap"))
    await c.command(P.rotate_180(True))


@test("dondur_kapat", "Döndürme kapalı (51)", "Görüntü normale döner.")
async def _(c):
    await c.command(P.rotate_180(False))


@test("eski_komutlar", "NEGATİF: eski 2 byte LEN komutları (00 04/06/07, 05 03)",
      "Hepsi ST=0 ile reddedilmeli: sağda '.. .. 01 00' cevapları, ekranda değişiklik yok.")
async def _(c):
    for raw in ([0x00, 0x04, 0x00, 0x01, 1], [0x00, 0x06, 0x00, 0x01, 1], [0x00, 0x07, 0x00, 0x01, 1],
                [0x05, 0x03, 0x00, 0x04, 1, 0, 100, 100]):
        await c.command(P.with_crc(*raw))


def _clock(style: int):
    async def run(c):
        await c.command(P.clock(style))
    return run


for _s in range(4):
    test(f"saat_stil_{_s}", f"Saat göstergesi, stil {_s} (0E)", "Şu anki saat, stile özgü tasarımla.",
         describe=True)(_clock(_s))


@test("gorunmez", "Senkron (55) + dil (53)", "Görünür etki yok. Sorun yoksa Oldu.")
async def _(c):
    await c.command(P.sync())
    await c.command(P.language(1))


async def _schedule_off_in(c: Panel, minutes: int) -> None:
    t = datetime.now() + timedelta(minutes=minutes)
    await c.command(P.schedule(off=(t.hour, t.minute)))
    note(f"Panel saat {t:%H:%M}:00'da kapanmalı. O saate kadar BEKLE, sonra cevap ver.")


async def _schedule_clear(c: Panel) -> None:
    await c.command(P.schedule())
    await c.command(P.power(True))


@test("zamanlayici", "Zamanlayıcı: belirli saatte kapan (0F)",
      "Panel aşağıda yazan saatte kendiliğinden kapanmalı. Cevaptan sonra zamanlayıcı silinir ve ekran açılır.",
      after=_schedule_clear)
async def _(c):
    await _schedule_off_in(c, 2)


@test("reset", "Reset (50) — en son", "DİKKAT: fabrika ayarına dönebilir. İstemiyorsan Atla. Ne oldu?", describe=True)
async def _(c):
    await c.command(P.reset())


# ---------------------------------------------------------------- akış
def save_result(log: EventLog, t: dict, ans: dict) -> None:
    rec = {"t": round(time.time(), 3), "id": t["id"], "title": t["title"], "result": ans["action"],
           "note": ans.get("note", ""), "sent": S.sent[-30:], "recv": S.recv[-30:]}
    with open(RESULTS, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    log.ev("obs", f"SONUÇ [{ans['action']}] {ans.get('note', '')}", text=f"{ans['action']}: {ans.get('note', '')}")


async def runner(addr: str, start: int, answers: asyncio.Queue) -> None:
    log = EventLog("test", LOG_DIR)
    panel = Panel(addr, log, on_tx=on_tx, on_rx=on_rx)
    await panel.connect()
    with S.lock:
        S.connected = True
    i = start
    while 0 <= i < len(TESTS):
        t = TESTS[i]
        log.set_exp(f"T_{t['id']}")
        with S.lock:
            S.cur, S.phase, S.msg = i, "gönderiliyor", ""
            S.sent.clear()
            S.recv.clear()
            S.tests[i]["status"] = "running"
        try:
            await t["run"](panel)
        except LinkDead:
            note("bağlantı koptu ve geri gelmedi")
        except Exception as e:  # noqa: BLE001
            note(f"hata: {type(e).__name__}: {e}")
        with S.lock:
            S.phase = "cevap bekleniyor"
        ans = await answers.get()
        if ans["action"] == "retry":
            continue
        if ans["action"] == "goto":
            with S.lock:
                if S.tests[i]["status"] == "running":
                    S.tests[i]["status"] = ""
            i = int(ans["index"])
            continue
        save_result(log, t, ans)
        with S.lock:
            S.tests[i]["status"] = ans["action"]
            S.tests[i]["note"] = ans.get("note", "")
        if t["after"]:
            try:
                await t["after"](panel)
            except Exception as e:  # noqa: BLE001
                note(f"geri alma hatası: {e}")
        i += 1
    with S.lock:
        S.phase, S.cur = "bitti", -1
    await panel.close()


def make_handler(loop: asyncio.AbstractEventLoop, answers: asyncio.Queue):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a) -> None:
            pass

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            if self.path.startswith("/state"):
                self._send(200, json.dumps(S.snap(), ensure_ascii=False).encode(), "application/json; charset=utf-8")
            else:
                self._send(200, PAGE.encode(), "text/html; charset=utf-8")

        def do_POST(self) -> None:
            ans = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            with S.lock:
                if S.phase != "cevap bekleniyor":
                    self._send(409, b'{"ok":false}', "application/json")
                    return
                S.phase = "işleniyor"
            loop.call_soon_threadsafe(answers.put_nowait, ans)
            self._send(200, b'{"ok":true}', "application/json")
    return Handler


async def main() -> None:
    ap = argparse.ArgumentParser(description="SLQ doğrulama paketi")
    ap.add_argument("--addr", default="71:85:ED:B5:55:F7")
    ap.add_argument("--from", dest="start", help="bu test id'sinden başla")
    ap.add_argument("--port", type=int, default=8766)
    ap.add_argument("--list", action="store_true", help="testleri listele ve çık")
    a = ap.parse_args()
    if a.list:
        for t in TESTS:
            print(f"{t['id']:22} {t['title']}")
        return
    S.tests = [{"id": t["id"], "title": t["title"], "expect": t["expect"], "describe": t["describe"],
                "status": "", "note": ""} for t in TESTS]
    if RESULTS.exists():
        by_id = {t["id"]: t for t in S.tests}
        for ln in RESULTS.read_text(encoding="utf-8").splitlines():
            r = json.loads(ln)
            if r["id"] in by_id:
                by_id[r["id"]].update(status=r["result"], note=r["note"])
    start = next((k for k, t in enumerate(TESTS) if t["id"] == a.start), 0)
    answers: asyncio.Queue = asyncio.Queue()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(asyncio.get_running_loop(), answers))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"Doğrulama arayüzü: http://localhost:{a.port}  ({len(TESTS)} test)", flush=True)
    await runner(a.addr, start, answers)
    print("Tüm testler bitti. Sonuçlar:", RESULTS, flush=True)
    await asyncio.sleep(3600)   # sonuç ekranı açık kalsın


if __name__ == "__main__":
    asyncio.run(main())
