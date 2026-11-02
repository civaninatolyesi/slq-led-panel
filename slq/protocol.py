"""
SLQ panel BLE protokolü: sabitler, CRC'ler, çerçeve kurucular ve cevap çözücü.

Spesifikasyon: docs/protocol/. Buradaki her komut kurucu, docs/protocol/03-commands.md'deki
bir satıra karşılık gelir. Doğrulanmamış alanlar docstring'de belirtilmiştir.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum


# ---------------------------------------------------------------- GATT / advertising
def _u16(x: int) -> str:
    return f"0000{x:04x}-0000-1000-8000-00805f9b34fb"


SERVICE_UUID = _u16(0xC820)
CMD_CHAR = _u16(0xC821)       # komutlar (CRC16 ekli çerçeve)
DATA_CHAR = _u16(0xC822)      # toplu veri parçaları
NOTIFY_CHAR = _u16(0xC823)    # panel cevapları
OTA_WRITE_CHAR = _u16(0xAE01)   # JieLi OTA — bu projede YAZILMAZ
OTA_NOTIFY_CHAR = _u16(0xAE02)

MFR_ID = 0x4801
ADV_SIGNATURE = bytes([0x57, 0x00, 0x01])   # 0x4801 üretici verisinin ilk 3 byte'ı
NAME_PREFIX = "SLQ-"

PANEL_W, PANEL_H = 48, 12
CHUNK_SIZE = 446              # uygulamadaki değer: ATT MTU 472 - 26


# ---------------------------------------------------------------- sayısal sabitler
class Status(IntEnum):
    REJECTED = 0
    OK = 1
    SAME = 3                  # aynı veri (CRC32C) panelde zaten var


class Effect(IntEnum):
    """Metin efektleri (firmware numaraları; uygulamanın buton sırası farklıdır)."""
    FIXED = 0
    LEFT = 1
    RIGHT = 2                 # karakter sırası ters görünür ("OLLEH")
    UP = 3
    DOWN = 4
    PAGE_5 = 5                # sayfa geçişi; kar efekti olduğu doğrulanmadı
    PAGE_6 = 6                # sayfa geçişi; perde efekti olduğu doğrulanmadı
    LASER = 7


class GraffitiMode(IntEnum):
    NEW = 1                   # tuvali temizle, grafiti moduna gir
    DONE = 2                  # uygulama: grafiti verisi gönderildikten sonra
    EXIT = 4                  # önceki programa dön


class PixelMode(IntEnum):
    DRAW = 0
    MIRROR_H = 1              # firmware yatay simetriği de çizer
    MIRROR_V = 2              # firmware dikey simetriği de çizer
    MOVE = 3                  # doğrulanmadı
    ERASE = 4


class BikeSignal(IntEnum):
    LEFT = 0
    RIGHT = 1
    RIDING = 2
    STOPPED = 3


# ---------------------------------------------------------------- CRC
def crc16(data: bytes) -> bytes:
    """CRC-16/MODBUS (poly 0xA001 yansıtılmış, init 0xFFFF), yüksek byte önce."""
    c = 0xFFFF
    for b in data:
        c ^= b
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c.to_bytes(2, "big")


_CRC32C_TABLE = []
for _n in range(256):
    _c = _n
    for _ in range(8):
        _c = (_c >> 1) ^ 0x82F63B78 if _c & 1 else _c >> 1
    _CRC32C_TABLE.append(_c)


def crc32c(data: bytes) -> bytes:
    """CRC-32C (Castagnoli), büyük endian. Transfer başlatma komutlarında verinin özetidir."""
    c = 0xFFFFFFFF
    for b in data:
        c = _CRC32C_TABLE[(c ^ b) & 0xFF] ^ (c >> 8)
    return (c ^ 0xFFFFFFFF).to_bytes(4, "big")


# ---------------------------------------------------------------- çerçeve
def frame(cmd: int, sub: int, payload: bytes | list[int] = b"") -> bytes:
    """CMD | SUB | LEN | PAYLOAD | CRC16_BE"""
    payload = bytes(x & 0xFF for x in payload)
    body = bytes([cmd, sub, len(payload)]) + payload
    return body + crc16(body)


def with_crc(*raw: int) -> bytes:
    """Ham byte dizisine CRC16 ekler (LEN alanı çağıranın sorumluluğunda)."""
    body = bytes(x & 0xFF for x in raw)
    return body + crc16(body)


@dataclass
class Response:
    cmd: int
    sub: int
    payload: bytes
    crc_ok: bool
    raw: bytes
    chunk_index: int | None = None     # yalnızca parça ACK'lerinde

    @property
    def status(self) -> int | None:
        return self.payload[0] if self.payload else None

    def is_(self, cmd: int, sub: int) -> bool:
        return self.cmd == cmd and self.sub == sub


def parse_response(data: bytes) -> Response | None:
    """C823 notify'ını çözer. Parça ACK'i (01 01 IDX_hi IDX_lo LEN …) özel biçimdedir."""
    if len(data) < 5 or data[:3] == b"\xfe\xdc\xba":     # JieLi OTA çerçeveleri
        return None
    crc_ok = crc16(data[:-2]) == data[-2:]
    if data[0] == 0x01 and data[1] == 0x01 and len(data) >= 7:
        n = data[4]
        return Response(1, 1, data[5:5 + n], crc_ok, data, chunk_index=int.from_bytes(data[2:4], "big"))
    n = data[2]
    return Response(data[0], data[1], data[3:3 + n], crc_ok, data)


# ---------------------------------------------------------------- komutlar (C821)
def query_info() -> bytes:
    """Cevap: 5A 01 0B … ; payload[2] = 1 ise şifre var."""
    return frame(0x5A, 0x01, [1])


def brightness(level: int) -> bytes:
    """level 1..100. Panel cevap vermez."""
    return frame(0x00, 0x01, [max(1, min(100, level))])


def power(on: bool) -> bytes:
    return frame(0x00, 0x03, [1 if on else 0])


def rotate_180(on: bool) -> bytes:
    return frame(0x51, 0x01, [1 if on else 0])


def text_style(effect: int = Effect.FIXED, speed: int = 100, color_index: int = 0,
               rgb: tuple[int, int, int] = (255, 0, 0), bg_index: int = 0,
               bg_rgb: tuple[int, int, int] = (0, 0, 0), orientation: int = 0) -> bytes:
    """Paneldeki metnin efekt/hız/renk/yönünü metni yeniden göndermeden değiştirir.
    color_index 0 = rgb kullan; 1..7 hazır gradyanlar (3 = mavi→mor→kırmızı). orientation 1 = dikey."""
    return frame(0x54, 0x01, [effect, speed, color_index, *rgb, bg_index, *bg_rgb, orientation])


def graffiti(mode: GraffitiMode) -> bytes:
    return frame(0x0B, 0x01, [mode])


def pixel(x: int, y: int, rgb: tuple[int, int, int], mode: PixelMode = PixelMode.DRAW) -> bytes:
    """x 0..47 (sütun), y 0..11 (satır). Panel cevap vermez."""
    return frame(0x0C, 0x01, [mode, x, y, *rgb])


def rhythm(style: int, bands: list[int]) -> bytes:
    """style 0..4, 12 bant, her biri 0..16. Panel cevap vermez; müzik boyunca sürekli gönderilir."""
    if len(bands) != 12:
        raise ValueError("12 bant gerekli")
    return frame(0x0D, 0x01, [style, *(max(0, min(16, b)) for b in bands)])


def rhythm_off() -> bytes:
    return frame(0x0D, 0x02, [1])


def bike_signal(state: BikeSignal) -> bytes:
    return frame(0x10, 0x01, [state])


def bike_speed(value: float, mph: bool = False) -> bytes:
    whole = int(value)
    return frame(0x11, 0x01, [1 if mph else 0, whole, int(round((value - whole) * 10)) % 10])


def playlist_begin(count: int) -> bytes:
    """Ardından her öğe image_start/text_start ile IDX = 1..count olarak gönderilir."""
    return frame(0x0A, 0x01, [count])


def playlist_clear() -> bytes:
    """Panel fabrika demo animasyonlarına döner."""
    return frame(0x0A, 0x02, [0])


def clock(style: int = 1, z: int = 1, z2: int = 0, now: datetime | None = None) -> bytes:
    """Saat göstergesi. style 0..3 farklı tasarımlar. z / z2'nin etkisi doğrulanmadı."""
    n = now or datetime.now()
    return frame(0x0E, 0x01, [style, z, z2, n.year >> 8, n.year & 0xFF, n.month - 1, n.day - 1,
                              n.hour, n.minute, n.second])


def schedule_byte(enabled: bool, days: set[int] = frozenset(range(1, 8))) -> int:
    """bit0 = 1 etkin (panelde doğrulandı), bit1..7 = gün 1..7 (hangi bitin hangi gün olduğu doğrulanmadı)."""
    v = 1 if enabled else 0
    for d in days:
        v |= 1 << d
    return v if enabled else 0


def schedule(on: tuple[int, int] | None = None, off: tuple[int, int] | None = None,
             days: set[int] = frozenset(range(1, 8)), now: datetime | None = None) -> bytes:
    """Otomatik aç/kapa. on/off = (saat, dakika) ya da None (kapalı). Panel saatini de ayarlar."""
    n = now or datetime.now()
    on_h, on_m = on or (0, 0)
    off_h, off_m = off or (0, 0)
    return frame(0x0F, 0x01, [n.year >> 8, n.year & 0xFF, n.month - 1, n.day - 1, n.hour, n.minute, n.second,
                              on_h, on_m, schedule_byte(on is not None, days),
                              off_h, off_m, schedule_byte(off is not None, days)])


def sync() -> bytes:
    return frame(0x55, 0x01, [1])


def language(code: int) -> bytes:
    """0 = Çince, 1 = diğer. Görünür etkisi gözlenmedi."""
    return frame(0x53, 0x01, [code])


def reset() -> bytes:
    return frame(0x50, 0x01, [1])


# ---------------------------------------------------------------- transfer (C821 + C822)
def text_start(data: bytes, index: int = 0, effect: int = Effect.FIXED, speed: int = 100,
               color_index: int = 0, bg_index: int = 0, bg_rgb: tuple[int, int, int] = (0, 0, 0),
               orientation: int = 0) -> bytes:
    """index 0 = doğrudan göster, 1..N = playlist öğesi."""
    return frame(0x02, 0x01, [index, *len(data).to_bytes(2, "big"), effect, speed, color_index, bg_index,
                              *bg_rgb, orientation, *crc32c(data)])


def image_start(data: bytes, index: int = 0) -> bytes:
    """data = GIF dosyasının baytları (48x12)."""
    return frame(0x08, 0x02, [index, *crc32c(data)])


def transfer_done() -> bytes:
    """Uygulamanın gönderdiği biçim: içteki CRC'li çerçeveye bir CRC daha eklenir (8 byte)."""
    inner = with_crc(0x01, 0x02, 0x01, 0x01)
    return inner + crc16(inner)


TEXT_CHUNK_HEADER = bytes([0x01, 0x02, 0x01])
IMAGE_CHUNK_HEADER = bytes([0x01, 0x08, 0x02])


def chunks(header: bytes, data: bytes, size: int = CHUNK_SIZE) -> list[bytes]:
    """C822 parçaları: HEADER | TOPLAM u32 BE | NO u16 BE | UZ u16 BE | VERİ | CRC16 BE"""
    out = []
    for i, off in enumerate(range(0, len(data), size)):
        part = data[off:off + size]
        body = header + len(data).to_bytes(4, "big") + i.to_bytes(2, "big") + len(part).to_bytes(2, "big") + part
        out.append(body + crc16(body))
    return out
