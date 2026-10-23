#!/usr/bin/env python3
"""Turn BYM pictogram PNGs into mask-ready icons: transparent background, dark shape opaque.
Pure Python (zlib only). Usage: python3 -I tools/pictograms.py <src_dir> <out_dir>"""
import os, sys, struct, zlib

MAP = {  # output name : source image in BYM_PNG.xlsx
    'door': 'image1', 'signal': 'image3', 'hazard': 'image5', 'work-front': 'image6', 'work-rear': 'image7',
    'window-heat': 'image8', 'steer-lock': 'image9', 'headlight': 'image10', 'lockup': 'image29',
    'engine': 'image11', 'oil-level': 'image12', 'preheat': 'image13', 'water-fuel': 'image14',
    'park-brake': 'image15', 'air-filter': 'image16', 'oil-pressure': 'image17', 'trans-pressure': 'image18',
    'fuel': 'image19', 'trans-temp': 'image20', 'hours': 'image21', 'coolant': 'image22', 'battery': 'image23',
    'fuel-pressure': 'image24', 'seat-belt': 'image25', 'brake': 'image26', 'ac': 'image27', 'turbo': 'image30',
    'key': 'image31', 'unlock': 'image32', 'lock': 'image33', 'retarder': 'image34', 'engine-shutoff': 'image35',
}

def read_png(path):
    b = open(path, 'rb').read()
    assert b[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, plte, trns = 8, b'', None, None
    while pos < len(b):
        ln, typ = struct.unpack('>I4s', b[pos:pos + 8]); data = b[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if typ == b'IHDR': w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', data)
        elif typ == b'PLTE': plte = data
        elif typ == b'tRNS': trns = data
        elif typ == b'IDAT': idat += data
    assert bd == 8 and il == 0, (path, bd, il)
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(idat); stride = w * ch; out = []; prev = bytearray(stride); i = 0
    for _ in range(h):
        f = raw[i]; line = bytearray(raw[i + 1:i + 1 + stride]); i += 1 + stride
        for x in range(stride):
            a = line[x - ch] if x >= ch else 0; up = prev[x]; c = prev[x - ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + up) & 255
            elif f == 3: line[x] = (line[x] + ((a + up) >> 1)) & 255
            elif f == 4:
                p = a + up - c; pa, pb, pc = abs(p - a), abs(p - up), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        out.append(bytes(line)); prev = line
    px = []
    for line in out:
        row = []
        for x in range(w):
            if ct == 6: r, g, bl, al = line[x * 4:x * 4 + 4]
            elif ct == 2: r, g, bl = line[x * 3:x * 3 + 3]; al = 255
            elif ct == 0: r = g = bl = line[x]; al = 255
            elif ct == 4: r = g = bl = line[x * 2]; al = line[x * 2 + 1]
            else:
                k = line[x]; r, g, bl = plte[k * 3:k * 3 + 3]; al = trns[k] if trns and k < len(trns) else 255
            row.append((r, g, bl, al))
        px.append(row)
    return w, h, px

def write_png(path, w, h, alpha):
    raw = b''.join(b'\x00' + bytes(v for a in row for v in (0, 0, 0, a)) for row in alpha)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for name, img in MAP.items():
    w, h, px = read_png(os.path.join(src, img + '.png'))
    lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
    solid = [lum(p) for row in px for p in row if p[3] > 200]
    dark = min(solid) if solid else 0
    hi = 245.0; span = max(25.0, hi - dark - 15)
    alpha = [[int(round(p[3] * max(0.0, min(1.0, (hi - lum(p)) / span)))) for p in row] for row in px]
    # crop to content
    ys = [y for y in range(h) if max(alpha[y]) > 10]; xs = [x for x in range(w) if max(alpha[y][x] for y in range(h)) > 10]
    y0, y1, x0, x1 = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
    alpha = [row[x0:x1] for row in alpha[y0:y1]]
    write_png(os.path.join(dst, name + '.png'), x1 - x0, y1 - y0, alpha)
    print(name, img, x1 - x0, 'x', y1 - y0)
