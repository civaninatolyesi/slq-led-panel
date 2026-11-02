# 2. Çerçeveleme

## 2.1 Komut çerçevesi (C821)

```
+-----+-----+-----+-------------------+----------+----------+
| CMD | SUB | LEN | PAYLOAD (LEN bayt) | CRC16_hi | CRC16_lo |
+-----+-----+-----+-------------------+----------+----------+
```

| Alan | Boyut | Açıklama |
|---|---|---|
| CMD | 1 | komut ailesi |
| SUB | 1 | alt komut |
| LEN | 1 | PAYLOAD uzunluğu |
| PAYLOAD | LEN | komuta özgü |
| CRC16 | 2 | CMD'den PAYLOAD sonuna kadar CRC-16/MODBUS, **yüksek bayt önce** |

Her BLE yazması tek bir çerçevedir. Panel yazma uzunluğunun ötesindeki baytlara bakmaz;
birden fazla çerçeveyi tek yazmada birleştirmek desteklenmez.

Örnek, parlaklık %10: `00 01 01 0a 73 d0`

> **Eski biçim:** Uygulamada `00 04 00 01 EE` gibi 2 baytlık uzunluk alanı kullanan bir komut ailesi de var.
> Firmware 1.0.6 bunların hepsini **ST=0 ile reddeder** (Doğrulandı). Bu biçim kullanılmamalı.

## 2.2 CRC-16/MODBUS

| Parametre | Değer |
|---|---|
| Polinom | 0x8005 (yansıtılmış 0xA001) |
| Başlangıç | 0xFFFF |
| Giriş/çıkış yansıtma | evet / evet |
| Son XOR | 0x0000 |
| Kontrol değeri (`"123456789"`) | 0x4B37 |
| **Kabloda bayt sırası** | **yüksek bayt önce** (standart Modbus RTU'nun tersi) |

```python
def crc16(data: bytes) -> bytes:
    c = 0xFFFF
    for b in data:
        c ^= b
        for _ in range(8):
            c = (c >> 1) ^ 0xA001 if c & 1 else c >> 1
    return c.to_bytes(2, "big")
```

Panel kendi cevaplarına da aynı CRC'yi aynı bayt sırasıyla ekler (Doğrulandı).

## 2.3 CRC-32C

Transfer başlatma komutları, gönderilecek verinin tamamının CRC-32C (Castagnoli) değerini taşır.
Panel bu değeri, aynı içeriğin zaten yüklü olup olmadığını anlamak için kullanır (ST=3).

| Parametre | Değer |
|---|---|
| Polinom | 0x1EDC6F41 (yansıtılmış 0x82F63B78) |
| Başlangıç / son XOR | 0xFFFFFFFF / 0xFFFFFFFF |
| Kontrol değeri (`"123456789"`) | 0xE3069283 |
| Kabloda bayt sırası | büyük endian |

Uygulama Guava `Hashing.crc32c()` kullanır.

## 2.4 Cevap çerçevesi (C823)

Cevaplar komutla aynı biçimdedir. Çoğu komutun cevabı tek baytlık bir durum taşır:

```
CMD SUB 01 ST CRC16_hi CRC16_lo
```

| ST | Anlam |
|---|---|
| `01` | kabul edildi |
| `00` | reddedildi (bilinmeyen komut, yanlış uzunluk ya da biçim) |
| `03` | aynı veri panelde zaten var (yalnızca transfer başlatma komutlarında) |

Örnekler: `00 03 01 01 74 30` ekran komutu kabul edildi, `00 04 01 00 75 40` eski efekt komutu reddedildi.

### Sessiz komutlar

Aşağıdaki komutlar geçerli olduğunda **hiç cevap üretmez**. Bu bir hata sayılmamalıdır (Doğrulandı):

`00 01` parlaklık · `0C 01` piksel · `0D 01` ritim verisi · `53 01` dil · `55 01` senkron

Kumanda ailesi (`09`, `18`, `80`) da sessizdir ama bu modelde hiçbir etki yaratmaz.

### Özel cevaplar

| Cevap | Biçim |
|---|---|
| Durum sorgusu | `5A 01 0B` + 11 bayt ([komut referansı](03-commands.md#durum-sorgusu-5a-01)) |
| Parça onayı | `01 01 NO_hi NO_lo 03 01 CMD SUB` + CRC. LEN alanından önce 2 baytlık parça numarası vardır |
| Transfer sonu | `01 02 03 01 CMD SUB` + CRC. ST=1 ve başlatma komutunun yankısı |
| OTA | `FE DC BA …`. JieLi OTA kanalına ait, komut cevabı değildir; yok sayılır |

## 2.5 Zamanlama

| Ölçüm | Değer |
|---|---|
| Komut → cevap gecikmesi | tipik 30–80 ms (Doğrulandı) |
| Referans istemci cevap bekleme süresi | komut 0,4 s, transfer adımı 4 s |
| Ardışık piksel/ritim komutları | 30–80 ms aralıkla sorunsuz (Doğrulandı) |
