"""Generate original CHAD text mark icons using only the Python standard library."""
from pathlib import Path
import struct
import zlib

LETTERS = {
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
}

def icon(size):
    navy, gold, bone = (20, 40, 75), (176, 137, 76), (244, 241, 234)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            nx, ny = x / size, y / size
            color = navy
            # Keep the artwork inside the central maskable safe area.
            if .22 <= nx <= .78 and .70 <= ny <= .725:
                color = gold
            gx, gy = int((nx - .22) / .56 * 23), int((ny - .36) / .25 * 7)
            if .22 <= nx < .78 and .36 <= ny < .61 and 0 <= gy < 7:
                letter_index, col = divmod(gx, 6)
                if letter_index < 4 and col < 5 and LETTERS['CHAD'[letter_index]][gy][col] == '1':
                    color = gold
            row.extend(color)
        rows.append(row)
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')

if __name__ == '__main__':
    output = Path(__file__).resolve().parent.parent / 'icons'
    output.mkdir(exist_ok=True)
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        (output / name).write_bytes(icon(size))
        print(f'Generated {name}: {size} x {size}')
