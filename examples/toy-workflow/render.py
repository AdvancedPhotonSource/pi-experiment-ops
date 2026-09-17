"""Create a tiny PNG chart with the standard library, once per workflow run."""
import json
import os
from pathlib import Path
import struct
import sys
import zlib

run, input_file = map(Path, sys.argv[1:])
if "fail-command" in input_file.read_text() and not (run / "allow-render").exists():
    raise RuntimeError("Requested failure; create allow-render in the run directory to test resume")
review = json.loads((run / "review.md").read_text())
assert review["approved"] is True
dataset = json.loads((run / "generate.md").read_text())
receipt = run / "receipt.json"
if not receipt.exists():
    width, height = 240, 160
    values = dataset["values"]
    scale = max(abs(value) for value in values) or 1
    pixels = bytearray()
    for y in range(height):
        pixels.append(0)
        for x in range(width):
            bar = min(x // 80, 2)
            inside = x % 80 < 60 and y >= height - abs(values[bar]) / scale * 140
            pixels.extend((20, 120, 160) if inside else (245, 248, 250))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")
    (run / "chart.png").write_bytes(png)
    temporary = run / "receipt.tmp"
    temporary.write_text(json.dumps({"completed": True, "count": 1, "image": "chart.png"}))
    os.replace(temporary, receipt)
print(receipt.read_text())
