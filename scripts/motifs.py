"""Extended vector motif library — each category draws from 4 related motifs."""
import math
from PIL import Image, ImageDraw
import shaping as sh
from render import W, H, SS, S, hsv, F_NE, F_EN, F_EN_SB, F_EN_R


def _ctx(hue, seed, rot):
    import random
    from PIL import Image, ImageDraw
    lay = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = W / 2, H * 0.365
    return dict(d=d, lay=lay, cx=cx, cy=cy,
                accent=hsv(hue, 0.58, 1.0, 255),
                accent2=hsv((hue + 58) % 360, 0.52, 1.0, 255),
                soft=hsv(hue, 0.40, 1.0, 62),
                white=(245, 247, 255, 238),
                dark=hsv(hue, 0.55, 0.10, 240),
                rng=random.Random(seed), rot=rot, hue=hue)


def _ring(c, r, col=None, wdt=2.4, dashes=0):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    col = col or c["soft"]
    if dashes:
        seg = 360 / dashes
        for i in range(dashes):
            d.arc([S(cx - r), S(cy - r), S(cx + r), S(cy + r)], i * seg, i * seg + seg * 0.5,
                  fill=col, width=S(wdt))
    else:
        d.ellipse([S(cx - r), S(cy - r), S(cx + r), S(cy + r)], outline=col, width=S(wdt))


def _deco(c, r=None):
    r = r or c["rng"].choice([262, 288, 310])
    _ring(c, r, c["soft"], 2.2, c["rng"].choice([0, 18, 26, 34]))
    n = c["rng"].choice([0, 3, 5, 6, 8])
    for k in range(n):
        a = c["rot"] + k * 2 * math.pi / max(1, n) + c["rng"].random()
        rr = r + c["rng"].uniform(-6, 10)
        px, py = c["cx"] + rr * math.cos(a), c["cy"] + rr * 0.92 * math.sin(a)
        s = c["rng"].uniform(4, 8)
        c["d"].ellipse([S(px - s), S(py - s), S(px + s), S(py + s)], fill=c["accent2"])


def _dots_orbital(c, n=5, rad=250, size=17):
    for k in range(n):
        a = c["rot"] * 1.6 + k * 2 * math.pi / n
        px, py = c["cx"] + rad * math.cos(a), c["cy"] + rad * 0.55 * math.sin(a)
        c["d"].ellipse([S(px - size), S(py - size), S(px + size), S(py + size)], fill=c["accent2"])


# ---------------------------------------------------------------- space / tech

def m_rocket(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    by = cy + 30
    d.polygon([(S(cx), S(by - 280)), (S(cx + 92), S(by - 30)), (S(cx + 92), S(by + 165)),
               (S(cx - 92), S(by + 165)), (S(cx - 92), S(by - 30))], fill=c["white"])
    d.polygon([(S(cx - 92), S(by + 55)), (S(cx - 172), S(by + 195)), (S(cx - 92), S(by + 172))], fill=c["accent"])
    d.polygon([(S(cx + 92), S(by + 55)), (S(cx + 172), S(by + 195)), (S(cx + 92), S(by + 172))], fill=c["accent"])
    d.ellipse([S(cx - 40), S(by - 130), S(cx + 40), S(by - 46)], outline=c["accent"], width=S(7))
    d.rectangle([S(cx - 46), S(by + 168), S(cx + 46), S(by + 196)], fill=hsv(c["hue"], 0.3, 0.55, 255))
    for k in range(3):
        f = 0.25 + k * 0.25
        rr = 40 * (1 - f * 0.55)
        d.ellipse([S(cx - rr), S(by + 200 + k * 26 - rr * 0.6), S(cx + rr), S(by + 200 + k * 26 + rr * 1.5)],
                  fill=hsv(38 - k * 9, 1.0, 1.0, int(200 - k * 55)))


def m_atom(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in range(3):
        ang = c["rot"] * 0.6 + k * math.pi / 3
        rx, ry = 250, 84
        pts = []
        for i in range(0, 361, 5):
            a = math.radians(i)
            px, py = rx * math.cos(a), ry * math.sin(a)
            pts.append((S(cx + px * math.cos(ang) - py * math.sin(ang)),
                        S(cy + px * math.sin(ang) + py * math.cos(ang))))
        d.line(pts, fill=c["accent"] if k != 1 else c["accent2"], width=S(5), joint="curve")
    d.ellipse([S(cx - 46), S(cy - 46), S(cx + 46), S(cy + 46)], fill=c["accent"])
    d.ellipse([S(cx - 20), S(cy - 20), S(cx + 20), S(cy + 20)], fill=hsv(c["hue"], 0.2, 1, 200))
    for k in range(3):
        a = c["rot"] * 1.6 + k * 2.1
        px, py = 250 * math.cos(a), 84 * math.sin(a)
        ang = c["rot"] * 0.6 + k * math.pi / 3
        gx = cx + px * math.cos(ang) - py * math.sin(ang)
        gy = cy + px * math.sin(ang) + py * math.cos(ang)
        d.ellipse([S(gx - 18), S(gy - 18), S(gx + 18), S(gy + 18)], fill=c["accent2"])


def m_planet(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 170
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(c["hue"], 0.62, 0.85, 245))
    d.chord([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], 200, 340, fill=hsv(c["hue"], 0.7, 0.55, 210))
    for k in range(4):
        yy = cy - 90 + k * 58
        d.arc([S(cx - R), S(yy - 40), S(cx + R), S(yy + 40)], 190, 350, fill=hsv(c["hue"], 0.4, 1.0, 80), width=S(8))
    ang = -0.35
    for wdt, col, dz in ((26, hsv(c["hue"], 0.5, 1.0, 150), 0), (14, c["accent2"], 0)):
        pts_o, pts_i = [], []
        for i in range(0, 361, 8):
            a = math.radians(i)
            px, py = 300 * math.cos(a), 92 * math.sin(a)
            pts_o.append((S(cx + px * math.cos(ang) - py * math.sin(ang)),
                          S(cy + 20 + px * math.sin(ang) + py * math.cos(ang))))
            px2, py2 = (300 - wdt) * math.cos(a), (92 - wdt * 0.32) * math.sin(a)
            pts_i.append((S(cx + px2 * math.cos(ang) - py2 * math.sin(ang)),
                          S(cy + 20 + px2 * math.sin(ang) + py2 * math.cos(ang))))
        d.line(pts_o, fill=col, width=S(5), joint="curve")
        d.line(pts_i, fill=col, width=S(5), joint="curve")


def m_satellite(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 78), S(cy - 78), S(cx + 78), S(cy + 78)], radius=S(12), fill=c["white"])
    for k in (-1, 1):
        for j in range(2):
            x0 = cx + k * (96 + j * 96)
            d.rectangle([S(min(x0, x0 + k * 86)), S(cy - 62), S(max(x0, x0 + k * 86)), S(cy + 62)],
                        fill=hsv(c["hue"], 0.55, 0.7, 240), outline=c["accent"], width=S(4))
    d.line([(S(cx - 78), S(cy - 40)), (S(cx - 300), S(cy - 110))], fill=c["accent2"], width=S(6))
    d.line([(S(cx + 78), S(cy - 40)), (S(cx + 300), S(cy - 110))], fill=c["accent2"], width=S(6))
    d.arc([S(cx - 210), S(cy - 230), S(cx + 210), S(cy + 120)], 200, 340, fill=c["accent"], width=S(6))


def m_telescope(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.polygon([(S(cx - 210), S(cy - 60)), (S(cx + 190), S(cy - 190)), (S(cx + 210), S(cy - 120)),
               (S(cx - 190), S(cy + 10))], fill=c["white"])
    d.polygon([(S(cx - 210), S(cy - 60)), (S(cx - 250), S(cy - 45)), (S(cx - 230), S(cy + 5)),
               (S(cx - 190), S(cy + 10))], fill=c["accent"])
    for k, dx in enumerate((-120, 0, 120)):
        d.line([(S(cx + dx * 0.35), S(cy + 20)), (S(cx + dx), S(cy + 250))], fill=c["accent2"], width=S(10))
    d.line([(S(cx - 90), S(cy + 250)), (S(cx + 140), S(cy + 250))], fill=c["accent2"], width=S(10))
    for k in range(4):
        px, py = cx + 190 + k * 34, cy - 210 - k * 26
        s = 16 - k * 3
        d.ellipse([S(px - s), S(py - s), S(px + s), S(py + s)], fill=hsv(48, 0.25, 1.0, 220))


def m_chip(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 186), S(cy - 186), S(cx + 186), S(cy + 186)], radius=S(28),
                        fill=hsv(c["hue"], 0.45, 0.16, 240), outline=c["accent"], width=S(6))
    d.rounded_rectangle([S(cx - 84), S(cy - 84), S(cx + 84), S(cy + 84)], radius=S(14),
                        fill=hsv(c["hue"], 0.55, 0.42, 255))
    for k in range(6):
        off = -150 + k * 60
        d.line([(S(cx - 260), S(cy + off)), (S(cx - 186), S(cy + off))], fill=c["accent"], width=S(8))
        d.line([(S(cx + 186), S(cy + off)), (S(cx + 260), S(cy + off))], fill=c["accent"], width=S(8))
        d.line([(S(cx + off), S(cy - 260)), (S(cx + off), S(cy - 186))], fill=c["accent2"], width=S(8))
        d.line([(S(cx + off), S(cy + 186)), (S(cx + off), S(cy + 260))], fill=c["accent2"], width=S(8))


def m_phone(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 130), S(cy - 250), S(cx + 130), S(cy + 250)], radius=S(34),
                        fill=hsv(c["hue"], 0.4, 0.12, 250), outline=c["accent"], width=S(6))
    d.rounded_rectangle([S(cx - 104), S(cy - 200), S(cx + 104), S(cy + 190)], radius=S(14),
                        fill=hsv(c["hue"], 0.6, 0.35, 255))
    for k in range(4):
        d.rounded_rectangle([S(cx - 80), S(cy - 160 + k * 62), S(cx + 80), S(cy - 122 + k * 62)],
                            radius=S(10), fill=hsv(c["hue"], 0.35, 1.0, 60 + k * 20))
    d.ellipse([S(cx - 26), S(cy + 208), S(cx + 26), S(cy + 236)], fill=c["accent2"])


def m_gear(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R, teeth = 190, 12
    ang0 = c["rot"] * 0.5
    pts = []
    for i in range(teeth * 2):
        a = ang0 + i * math.pi / teeth
        r = R if i % 2 == 0 else R * 0.82
        pts.append((S(cx + r * math.cos(a)), S(cy + r * math.sin(a))))
    d.polygon(pts, fill=hsv(c["hue"], 0.5, 0.85, 245))
    d.ellipse([S(cx - 96), S(cy - 96), S(cx + 96), S(cy + 96)], fill=hsv(c["hue"], 0.55, 0.12, 255))
    d.ellipse([S(cx - 96), S(cy - 96), S(cx + 96), S(cy + 96)], outline=c["accent2"], width=S(7))


def m_wifi(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in range(4):
        r = 100 + k * 62
        d.arc([S(cx - r), S(cy + 90 - r), S(cx + r), S(cy + 90 + r)], 215, 325, fill=c["accent"], width=S(14))
    d.ellipse([S(cx - 30), S(cy + 60), S(cx + 30), S(cy + 120)], fill=c["accent2"])


def m_laptop(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 230), S(cy - 180), S(cx + 230), S(cy + 110)], radius=S(16),
                        fill=hsv(c["hue"], 0.45, 0.14, 250), outline=c["accent"], width=S(6))
    d.polygon([(S(cx - 300), S(cy + 180)), (S(cx + 300), S(cy + 180)), (S(cx + 230), S(cy + 110)),
               (S(cx - 230), S(cy + 110))], fill=hsv(c["hue"], 0.35, 0.75, 245))
    for k in range(3):
        d.line([(S(cx - 140), S(cy - 90 + k * 66)), (S(cx + 60 + k * 30), S(cy - 90 + k * 66))],
               fill=c["accent2"], width=S(10))


# ---------------------------------------------------------------- science / earth

def m_flask(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.polygon([(S(cx - 46), S(cy - 200)), (S(cx + 46), S(cy - 200)), (S(cx + 46), S(cy - 40)),
               (S(cx + 176), S(cy + 200)), (S(cx - 176), S(cy + 200)), (S(cx - 46), S(cy - 40))],
              fill=hsv(c["hue"], 0.3, 0.95, 190), outline=c["accent"], width=S(7))
    d.polygon([(S(cx - 118), S(cy + 84)), (S(cx + 118), S(cy + 84)), (S(cx + 168), S(cy + 190)),
               (S(cx - 168), S(cy + 190))], fill=c["accent"])
    for k in range(5):
        px = cx - 96 + k * 48
        py = cy + 130 - (k % 2) * 34
        d.ellipse([S(px - 16), S(py - 16), S(px + 16), S(py + 16)], fill=hsv(0, 0, 1, 130))
    for k in range(3):
        a = c["rot"] + k * 2.1
        px, py = cx + 60 * math.cos(a), cy - 230 - 40 * math.sin(a)
        d.ellipse([S(px - 14), S(py - 14), S(px + 14), S(py + 14)], outline=c["accent2"], width=S(5))


def m_dna(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    N = 26
    for i in range(N):
        p = i / (N - 1)
        y = cy - 300 + p * 600
        ph = p * 4.4 + c["rot"] * 0.4
        x1, x2 = cx + 150 * math.sin(ph), cx - 150 * math.sin(ph)
        rr = 19
        d.ellipse([S(x1 - rr), S(y - rr), S(x1 + rr), S(y + rr)], fill=c["accent"])
        d.ellipse([S(x2 - rr), S(y - rr), S(x2 + rr), S(y + rr)], fill=c["accent2"])
        if i % 2 == 0:
            d.line([(S(x1), S(y)), (S(x2), S(y))], fill=hsv(c["hue"], 0.4, 1.0, 120), width=S(7))

def m_magnet(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.arc([S(cx - 200), S(cy - 220), S(cx + 200), S(cy + 180)], 0, 180, fill=c["accent"], width=S(96))
    for k in (-1, 1):
        d.rectangle([S(cx + k * 200 - 48), S(cy - 40), S(cx + k * 200 + 48), S(cy + 120)],
                    fill=hsv(c["hue"], 0.55, 0.8, 245))
        d.rectangle([S(cx + k * 200 - 48), S(cy + 120), S(cx + k * 200 + 48), S(cy + 190)],
                    fill=hsv(0, 0, 0.92, 245))
    for k in range(6):
        a = c["rot"] + k * 1.05
        px, py = cx + 250 * math.cos(a), cy + 210 * math.sin(a) * 0.7
        d.line([(S(px - 12), S(py - 16)), (S(px + 12), S(py - 4))], fill=c["accent2"], width=S(6))
        d.line([(S(px + 12), S(py - 16)), (S(px - 12), S(py - 4))], fill=c["accent2"], width=S(6))


def m_microscope(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.line([(S(cx - 230), S(cy + 262)), (S(cx + 250), S(cy + 262))], fill=c["accent2"], width=S(24))
    d.rounded_rectangle([S(cx - 90), S(cy + 196), S(cx + 210), S(cy + 262)], radius=S(16), fill=c["accent2"])
    # arm
    d.arc([S(cx - 240), S(cy - 300), S(cx + 120), S(cy + 140)], 200, 20, fill=hsv(c["hue"], 0.45, 0.9, 250),
          width=S(40))
    # tube
    d.line([(S(cx + 40), S(cy + 150)), (S(cx + 96), S(cy - 210))], fill=c["white"], width=S(48))
    d.rounded_rectangle([S(cx + 62), S(cy - 292), S(cx + 140), S(cy - 186)], radius=S(26), fill=c["accent"])
    d.rounded_rectangle([S(cx + 2), S(cy - 186), S(cx + 142), S(cy - 132)], radius=S(16),
                        fill=hsv(c["hue"], 0.3, 0.55, 250))
    # stage
    d.rectangle([S(cx - 90), S(cy + 96), S(cx + 136), S(cy + 148)], fill=hsv(c["hue"], 0.35, 0.75, 245))
    d.ellipse([S(cx - 26), S(cy + 98), S(cx + 34), S(cy + 146)], fill=hsv(c["hue"], 0.5, 0.3, 250))
    # slide with specimen glow
    d.ellipse([S(cx - 210), S(cy - 268), S(cx - 96), S(cy - 154)], fill=hsv(c["hue"], 0.5, 0.9, 110))
    d.ellipse([S(cx - 176), S(cy - 234), S(cx - 130), S(cy - 188)], fill=hsv(c["hue"], 0.4, 1.0, 200))

def m_globe(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 285
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(c["hue"], 0.7, 0.34, 255),
              outline=c["accent"], width=S(9))
    d.ellipse([S(cx - R * .72), S(cy - R * .78), S(cx + R * .2), S(cy - R * .1)],
              fill=hsv(c["hue"], 0.6, 0.62, 90))
    for k in (-0.72, -0.42, 0, 0.42, 0.72):
        yy = cy + k * R
        hw = R * math.sqrt(max(0, 1 - k * k))
        d.line([(S(cx - hw), S(yy)), (S(cx + hw), S(yy))],
               fill=c["accent"] if abs(k) < .01 else hsv(c["hue"], 0.45, 1.0, 110), width=S(5))
    for k in range(6):
        a = c["rot"] * 0.4 + k * math.pi / 6
        hw = abs(R * math.cos(a))
        for a0, a1 in ((-90, 90), (90, 270)):
            d.arc([S(cx - hw), S(cy - R), S(cx + hw), S(cy + R)], a0, a1,
                  fill=hsv(c["hue"], 0.45, 1.0, 110), width=S(5))
    for k in range(3):
        ang = c["rng"].uniform(0, 6.28)
        rr = c["rng"].uniform(0.3, 0.7) * R
        px, py = cx + rr * math.cos(ang), cy + rr * 0.8 * math.sin(ang)
        d.ellipse([S(px - 34), S(py - 34), S(px + 34), S(py + 34)], fill=hsv(140, 0.55, 0.75, 150))

def m_mountain(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    base = cy + 250
    d.polygon([(S(cx - 30), S(cy - 260)), (S(cx + 330), S(base)), (S(cx - 390), S(base))],
              fill=hsv(c["hue"], 0.45, 0.55, 250))
    d.polygon([(S(cx - 30), S(cy - 260)), (S(cx - 150), S(cy - 40)), (S(cx + 20), S(cy - 40)),
               (S(cx + 40), S(cy - 110)), (S(cx + 18), S(cy - 140)), (S(cx + 86), S(cy - 40)),
               (S(cx + 170), S(cy - 40))], fill=hsv(c["hue"], 0.2, 0.98, 250))
    d.polygon([(S(cx), S(cy - 190)), (S(cx + 240), S(base)), (S(cx - 250), S(base))],
              fill=hsv(c["hue"], 0.55, 0.38, 250))
    for k in range(5):
        yy = base - 150 + k * 34
        d.line([(S(cx - 250 + k * 46), S(yy)), (S(cx + 250 - k * 46), S(yy))],
               fill=hsv(c["hue"], 0.3, 1.0, 55), width=S(5))
    d.ellipse([S(cx + 200), S(cy - 300), S(cx + 300), S(cy - 200)], fill=hsv(48, 0.3, 1.0, 190))

def m_volcano(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    base = cy + 250
    d.polygon([(S(cx - 360), S(base)), (S(cx - 90), S(cy - 170)), (S(cx + 90), S(cy - 170)),
               (S(cx + 360), S(base))], fill=hsv(c["hue"], 0.4, 0.45, 252))
    d.polygon([(S(cx - 90), S(cy - 170)), (S(cx + 90), S(cy - 170)), (S(cx + 46), S(cy - 70)),
               (S(cx - 46), S(cy - 70))], fill=hsv(12, 0.92, 1.0, 250))
    d.line([(S(cx - 40), S(cy - 40)), (S(cx - 20), S(base - 60))], fill=hsv(14, 0.9, 0.95, 200), width=S(14))
    for k in range(4):
        rr = 44 + k * 40
        d.ellipse([S(cx - rr), S(cy - 300 - k * 60), S(cx + rr), S(cy - 170 - k * 60)],
                  fill=hsv(22, 0.55, 0.95, 90 - k * 18))

def m_wave(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in range(5):
        yy = cy - 110 + k * 76
        pts = [(S(x), S(yy + 52 * math.sin(x / 130 + k + c["rot"] * 0.3)))
               for x in range(-120, int(W) + 120, 8)]
        d.line(pts, fill=hsv(c["hue"], 0.55, 1.0, 210) if k % 2 == 0 else c["accent2"],
               width=S(9), joint="curve")
    d.arc([S(cx - 120), S(cy - 300), S(cx + 120), S(cy - 40)], 60, 300, fill=c["white"], width=S(12))

def w_int():
    return int(W)


def m_compass(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 262
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(c["hue"], 0.45, 0.22, 250),
              outline=c["accent"], width=S(10))
    for k in range(12):
        a = k * math.pi / 6
        d.line([(S(cx + (R - 18) * math.cos(a)), S(cy + (R - 18) * math.sin(a))),
                (S(cx + (R - 52) * math.cos(a)), S(cy + (R - 52) * math.sin(a)))],
               fill=hsv(c["hue"], 0.4, 1.0, 150), width=S(6))
    a = -math.pi / 2 + 0.35 * math.sin(c["rot"])
    d.polygon([(S(cx + 180 * math.cos(a)), S(cy + 180 * math.sin(a))),
               (S(cx + 56 * math.cos(a + 2.0)), S(cy + 56 * math.sin(a + 2.0))),
               (S(cx + 56 * math.cos(a - 2.0)), S(cy + 56 * math.sin(a - 2.0)))], fill=hsv(2, 0.8, 0.95, 250))
    d.polygon([(S(cx - 180 * 0.75 * math.cos(a)), S(cy - 180 * 0.75 * math.sin(a))),
               (S(cx + 56 * math.cos(a + 2.0)), S(cy + 56 * math.sin(a + 2.0))),
               (S(cx + 56 * math.cos(a - 2.0)), S(cy + 56 * math.sin(a - 2.0)))],
              fill=hsv(0, 0, 0.96, 210))
    d.ellipse([S(cx - 20), S(cy - 20), S(cx + 20), S(cy + 20)], fill=c["white"])

def m_paw(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.chord([S(cx - 210), S(cy - 30), S(cx + 210), S(cy + 330)], 180, 360, fill=c["accent"])
    d.chord([S(cx - 140), S(cy + 30), S(cx + 140), S(cy + 290)], 180, 360, fill=hsv(c["hue"], 0.28, 0.45, 110))
    for dx, dy, r in [(-182, -30, 58), (-92, -112, 62), (16, -128, 62), (124, -62, 58)]:
        d.ellipse([S(cx + dx - r), S(cy + dy - r), S(cx + dx + r), S(cy + dy + r)], fill=c["white"])

def m_fish(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.ellipse([S(cx - 210), S(cy - 110), S(cx + 120), S(cy + 110)], fill=hsv(c["hue"], 0.5, 0.9, 245))
    d.polygon([(S(cx + 100), S(cy)), (S(cx + 250), S(cy - 100)), (S(cx + 250), S(cy + 100))], fill=c["accent"])
    d.ellipse([S(cx - 160), S(cy - 34), S(cx - 116), S(cy + 10)], fill=(255, 255, 255, 245))
    d.ellipse([S(cx - 146), S(cy - 24), S(cx - 126), S(cy - 4)], fill=hsv(0, 0, 0.08, 245))
    for k in range(4):
        x = cx - 60 + k * 46
        d.arc([S(x - 30), S(cy - 90), S(x + 30), S(cy + 90)], 300, 60, fill=c["soft"], width=S(5))
    for k in range(5):
        px = cx + 60 * math.cos(c["rot"] + k)
        py = cy + 180 + k * 24
        d.ellipse([S(px - 12), S(py - 12), S(px + 12), S(py + 12)], outline=c["accent2"], width=S(5))


def m_bird(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.ellipse([S(cx - 100), S(cy - 140), S(cx + 110), S(cy + 130)], fill=hsv(c["hue"], 0.5, 0.9, 245))
    d.ellipse([S(cx + 60), S(cy - 200), S(cx + 190), S(cy - 80)], fill=hsv(c["hue"], 0.5, 0.9, 245))
    d.polygon([(S(cx + 180), S(cy - 160)), (S(cx + 290), S(cy - 128)), (S(cx + 180), S(cy - 110))],
              fill=hsv(40, 0.9, 1.0, 245))
    d.ellipse([S(cx + 138), S(cy - 168), S(cx + 166), S(cy - 140)], fill=hsv(0, 0, 0.1, 245))
    d.polygon([(S(cx - 60), S(cy + 20)), (S(cx - 300), S(cy - 120)), (S(cx - 240), S(cy + 60)),
               (S(cx - 70), S(cy + 110))], fill=c["accent"])
    for k in range(3):
        d.line([(S(cx + 120), S(cy + 140)), (S(cx + 40 + k * 60), S(cy + 300))], fill=c["accent2"], width=S(9))


def m_bug(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.ellipse([S(cx - 130), S(cy - 60), S(cx + 130), S(cy + 220)], fill=hsv(c["hue"], 0.55, 0.85, 245))
    d.line([(S(cx), S(cy - 50)), (S(cx), S(cy + 210))], fill=hsv(c["hue"], 0.6, 0.25, 220), width=S(7))
    d.ellipse([S(cx - 46), S(cy - 80), S(cx + 46), S(cy - 8)], fill=hsv(c["hue"], 0.55, 0.85, 245))
    for k in (-1, 1):
        for j in range(3):
            y = cy + 20 + j * 70
            d.line([(S(cx + k * 110), S(y)), (S(cx + k * 250), S(y - 40 + j * 30))],
                   fill=c["accent2"], width=S(9))
        d.line([(S(cx + k * 30), S(cy - 80)), (S(cx + k * 90), S(cy - 180))], fill=c["accent2"], width=S(8))
    for k in range(3):
        d.ellipse([S(cx - 70 + k * 70 - 12), S(cy + 60), S(cx - 70 + k * 70 + 12), S(cy + 84)],
                  fill=hsv(0, 0, 1, 90))


def m_footprint(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for row in range(2):
        for col in range(2):
            ox = cx - 130 + col * 250 + (row % 2) * 40
            oy = cy - 180 + row * 250
            d.ellipse([S(ox - 60), S(oy - 90), S(ox + 60), S(oy + 90)], fill=hsv(c["hue"], 0.5, 0.9, 220))
            d.ellipse([S(ox - 80), S(oy - 160), S(ox + 40), S(oy - 30)], fill=hsv(c["hue"], 0.5, 0.9, 130))
    d.line([(S(cx - 260), S(cy + 300)), (S(cx + 200), S(cy + 300))], fill=c["soft"], width=S(5))


# ---------------------------------------------------------------- body / history / culture

def m_heart(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    pts = []
    for i in range(160):
        a = i / 160 * 2 * math.pi
        x = 16 * math.sin(a) ** 3
        y = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
        pts.append((S(cx + x * 15.5), S(cy + y * 15.5)))
    d.polygon(pts, fill=hsv(c["hue"], 0.62, 1.0, 235))
    ex = []
    for i in range(0, 361):
        x = cx - 210 + i * (420 / 360)
        y = cy + 10 + 120 * (math.exp(-((i - 120) / 12.0) ** 2) - 1.4 * math.exp(-((i - 140) / 9.0) ** 2)
                             + 1.1 * math.exp(-((i - 158) / 12.0) ** 2))
        ex.append((S(x), S(y)))
    d.line(ex, fill=hsv(0, 0, 1, 235), width=S(6), joint="curve")


def m_brain(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.ellipse([S(cx - 220), S(cy - 190), S(cx + 220), S(cy + 190)], fill=hsv(c["hue"], 0.45, 0.9, 235))
    for k in range(5):
        r = 60 + k * 24
        d.arc([S(cx - r - 100), S(cy - r), S(cx - 20 + r), S(cy + r)], 40, 320, fill=c["soft"], width=S(6))
        d.arc([S(cx + 20 - r), S(cy - r), S(cx + 100 + r), S(cy + r)], 220, 140, fill=c["soft"], width=S(6))
    d.line([(S(cx), S(cy - 180)), (S(cx), S(cy + 180))], fill=hsv(c["hue"], 0.55, 0.5, 200), width=S(7))
    d.line([(S(cx - 40), S(cy + 190)), (S(cx + 60), S(cy + 330))], fill=c["accent2"], width=S(10))


def m_eye(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.polygon([(S(cx - 300), S(cy)), (S(cx), S(cy - 160)), (S(cx + 300), S(cy)),
               (S(cx), S(cy + 160))], fill=(250, 251, 255, 240))
    d.ellipse([S(cx - 108), S(cy - 108), S(cx + 108), S(cy + 108)], fill=c["accent"])
    d.ellipse([S(cx - 44), S(cy - 44), S(cx + 44), S(cy + 44)], fill=hsv(0, 0, 0.06, 245))
    d.ellipse([S(cx + 18), S(cy - 70), S(cx + 56), S(cy - 32)], fill=(255, 255, 255, 200))
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        d.line([(S(cx + 300 * math.cos(a)), S(cy + 160 * math.sin(a))),
                (S(cx + 370 * math.cos(a)), S(cy + 210 * math.sin(a)))], fill=c["accent2"], width=S(7))


def m_scroll(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 296), S(cy - 206), S(cx + 296), S(cy + 206)], radius=S(24), fill=c["white"])
    for k in range(7):
        yy = cy - 132 + k * 44
        wdt = 220 if k % 3 == 2 else 250
        d.line([(S(cx - wdt), S(yy)), (S(cx + wdt), S(yy))], fill=hsv(28, 0.75, 0.55, 150), width=S(6))
    for k in (-1, 1):
        d.rounded_rectangle([S(cx + k * 296 - 30), S(cy - 252), S(cx + k * 296 + 30), S(cy + 252)],
                            radius=S(26), fill=hsv(c["hue"], 0.45, 0.85, 245))
    d.line([(S(cx - 250), S(cy - 168)), (S(cx + 120), S(cy - 168))], fill=c["accent"], width=S(8))


def m_pillar(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in range(3):
        x = cx - 190 + k * 190
        d.rectangle([S(x - 40), S(cy - 170), S(x + 40), S(cy + 180)], fill=hsv(c["hue"], 0.25, 0.92, 235))
        for j in range(3):
            d.line([(S(x - 22 + j * 22), S(cy - 160)), (S(x - 22 + j * 22), S(cy + 170))], fill=c["soft"], width=S(4))
    d.rectangle([S(cx - 290), S(cy - 212), S(cx + 290), S(cy - 170)], fill=c["accent"])
    d.rectangle([S(cx - 310), S(cy + 180), S(cx + 310), S(cy + 222)], fill=c["accent2"])


def m_crown(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    pts = [(cx - 240, cy + 140), (cx - 240, cy - 110), (cx - 120, cy + 20), (cx, cy - 180),
           (cx + 120, cy + 20), (cx + 240, cy - 110), (cx + 240, cy + 140)]
    d.polygon([(S(x), S(y)) for x, y in pts], fill=hsv(45, 0.85, 0.98, 245))
    d.rectangle([S(cx - 240), S(cy + 140), S(cx + 240), S(cy + 200)], fill=hsv(45, 0.9, 0.8, 245))
    for x, y, col in [(cx, cy - 180, 0), (cx - 240, cy - 110, 210), (cx + 240, cy - 110, 210)]:
        d.ellipse([S(x - 22), S(y - 22), S(x + 22), S(y + 22)], fill=hsv(col, 0.7, 1.0, 255))


def m_hourglass(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rectangle([S(cx - 190), S(cy - 240), S(cx + 190), S(cy - 216)], fill=c["accent"])
    d.rectangle([S(cx - 190), S(cy + 216), S(cx + 190), S(cy + 240)], fill=c["accent"])
    d.polygon([(S(cx - 160), S(cy - 216)), (S(cx + 160), S(cy - 216)), (S(cx + 26), S(cy)),
               (S(cx + 160), S(cy + 216)), (S(cx - 160), S(cy + 216)), (S(cx - 26), S(cy))],
              fill=hsv(c["hue"], 0.3, 0.95, 120), outline=hsv(c["hue"], 0.25, 0.95, 240), width=S(6))
    d.polygon([(S(cx - 130), S(cy + 180)), (S(cx + 130), S(cy + 180)), (S(cx + 26), S(cy + 40)),
               (S(cx - 26), S(cy + 40))], fill=hsv(42, 0.85, 1.0, 235))
    d.polygon([(S(cx - 96), S(cy - 190)), (S(cx + 96), S(cy - 190)), (S(cx), S(cy - 90))],
              fill=hsv(42, 0.85, 1.0, 190))


def m_pyramid(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.polygon([(S(cx - 40), S(cy - 200)), (S(cx + 300), S(cy + 200)), (S(cx - 320), S(cy + 200))],
              fill=hsv(42, 0.7, 0.85, 245))
    d.polygon([(S(cx - 40), S(cy - 200)), (S(cx + 300), S(cy + 200)), (S(cx + 40), S(cy + 200))],
              fill=hsv(42, 0.8, 0.6, 245))
    for k in range(5):
        yy = cy - 100 + k * 58
        d.line([(S(cx - 40 - (k + 1) * 42), S(yy)), (S(cx - 40 + (k + 1) * 46), S(yy))],
               fill=hsv(42, 0.5, 1.0, 70), width=S(4))
    d.ellipse([S(cx + 210), S(cy - 210), S(cx + 290), S(cy - 130)], fill=hsv(48, 0.3, 1.0, 210))


def m_book(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k, sgn in enumerate((-1, 1)):
        d.polygon([(S(cx), S(cy - 40)), (S(cx + sgn * 280), S(cy - 120)), (S(cx + sgn * 280), S(cy + 130)),
                   (S(cx), S(cy + 210))], fill=hsv(c["hue"], 0.3, 0.95, 235))
        for j in range(4):
            yy = cy - 70 + j * 62
            d.line([(S(cx + sgn * 40), S(yy + 6)), (S(cx + sgn * 240), S(yy - 30))],
                   fill=hsv(c["hue"], 0.5, 0.5, 110), width=S(5))
    d.line([(S(cx), S(cy - 40)), (S(cx), S(cy + 210))], fill=c["accent"], width=S(8))


def m_mask(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in (-1, 1):
        d.polygon([(S(cx + k * 150), S(cy - 196)), (S(cx + k * 290), S(cy - 320)),
                   (S(cx + k * 232), S(cy - 150))], fill=hsv((c["hue"] + 40) % 360, 0.7, 0.9, 240))
    d.ellipse([S(cx - 216), S(cy - 236), S(cx + 216), S(cy + 236)], fill=hsv(c["hue"], 0.5, 0.92, 245))
    d.chord([S(cx - 216), S(cy - 236), S(cx + 216), S(cy + 236)], 205, 335,
            fill=hsv((c["hue"] + 45) % 360, 0.65, 0.7, 245))
    for k in (-1, 1):
        d.ellipse([S(cx + k * 88 - 56), S(cy - 96), S(cx + k * 88 + 56), S(cy + 16)], fill=(252, 253, 255, 240))
        d.ellipse([S(cx + k * 88 - 26), S(cy - 70), S(cx + k * 88 + 26), S(cy - 18)], fill=hsv(0, 0, 0.07, 248))
        d.arc([S(cx + k * 88 - 74), S(cy - 156), S(cx + k * 88 + 74), S(cy - 30)], 200, 340,
              fill=hsv(0, 0, 0.1, 150), width=S(10))
    d.ellipse([S(cx - 30), S(cy - 168), S(cx + 30), S(cy - 108)], fill=c["accent2"])
    d.arc([S(cx - 120), S(cy + 40), S(cx + 120), S(cy + 200)], 195, 345, fill=(250, 250, 252, 235), width=S(18))
    for i in range(11):
        a = math.pi + i * math.pi / 10
        d.line([(S(cx + 220 * math.cos(a)), S(cy + 240 * math.sin(a))),
                (S(cx + 300 * math.cos(a)), S(cy + 330 * math.sin(a)))], fill=c["accent"], width=S(10))

def m_note(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.line([(S(cx - 40), S(cy - 220)), (S(cx - 40), S(cy + 120))], fill=c["white"], width=S(12))
    d.line([(S(cx + 130), S(cy - 260)), (S(cx + 130), S(cy + 80))], fill=c["white"], width=S(12))
    d.polygon([(S(cx - 40), S(cy - 220)), (S(cx + 130), S(cy - 260)), (S(cx + 130), S(cy - 190)),
               (S(cx - 40), S(cy - 150))], fill=c["accent"])
    for x, y in ((cx - 90, cy + 150), (cx + 80, cy + 110)):
        d.ellipse([S(x - 58), S(y - 40), S(x + 58), S(y + 44)], fill=c["accent2"])


def m_palette(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.ellipse([S(cx - 270), S(cy - 230), S(cx + 270), S(cy + 230)], fill=hsv(c["hue"], 0.2, 0.95, 240))
    d.ellipse([S(cx + 40), S(cy + 100), S(cx + 200), S(cy + 220)], fill=hsv(c["hue"], 0.45, 0.12, 255))
    for k, col in enumerate([0, 40, 120, 190, 265]):
        a = k * 1.1
        px, py = cx - 120 + 110 * math.cos(a), cy - 40 + 80 * math.sin(a)
        d.ellipse([S(px - 42), S(py - 42), S(px + 42), S(py + 42)], fill=hsv(col, 0.75, 1.0, 245))


def m_flute(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    ang = -0.55
    dx, dy = math.cos(ang), math.sin(ang)
    L = 330
    for k in range(7):
        off = -L * 0.42 + k * 40
        x, y = cx + off * dx, cy + off * dy
        d.ellipse([S(x - 20), S(y - 20), S(x + 20), S(y + 20)], fill=hsv(0, 0, 0.08, 250))
    d.line([(S(cx - L * dx), S(cy - L * dy)), (S(cx + L * dx), S(cy + L * dy))],
           fill=hsv(36, 0.5, 0.98, 250), width=S(64))
    d.line([(S(cx - L * 0.9 * dx), S(cy - L * 0.9 * dy)), (S(cx + L * 0.9 * dx), S(cy + L * 0.9 * dy))],
           fill=hsv(36, 0.25, 0.7, 160), width=S(10))
    for k in range(6):
        off = -L * 0.30 + k * 46
        x, y = cx + off * dx, cy + off * dy
        d.ellipse([S(x - 17), S(y - 17), S(x + 17), S(y + 17)], fill=hsv(0, 0, 0.1, 250))

def m_ball(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 262
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=(247, 249, 253, 250))
    pr = 74
    for k in range(5):
        a = c["rot"] * 0.25 + k * 2 * math.pi / 5
        px, py = cx + R * 0.60 * math.cos(a), cy + R * 0.60 * math.sin(a)
        d.line([(S(cx), S(cy)), (S(px), S(py))], fill=hsv(220, 0.4, 0.2, 190), width=S(7))
        d.polygon([(S(px + pr * math.cos(a + i * 2 * math.pi / 5)),
                    S(py + pr * math.sin(a + i * 2 * math.pi / 5))) for i in range(5)],
                 fill=hsv(220, 0.4, 0.16, 245))
    r0 = c["rot"] * 0.25
    d.polygon([(S(cx + pr * math.cos(r0 + i * 2 * math.pi / 5)),
                S(cy + pr * math.sin(r0 + i * 2 * math.pi / 5))) for i in range(5)],
             fill=hsv(220, 0.4, 0.16, 245))
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], outline=c["accent"], width=S(6))

def m_trophy(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.arc([S(cx - 66), S(cy - 250), S(cx + 66), S(cy - 40)], 0, 180, fill=hsv(45, 0.85, 0.98, 245), width=S(26))
    d.polygon([(S(cx - 170), S(cy - 240)), (S(cx + 170), S(cy - 240)), (S(cx + 110), S(cy - 40)),
               (S(cx - 110), S(cy - 40))], fill=hsv(45, 0.85, 0.98, 245))
    for k in (-1, 1):
        d.arc([S(cx + k * 200 - 80), S(cy - 220), S(cx + k * 200 + 80), S(cy - 60)], 270 if k > 0 else 90,
              90 if k > 0 else 270, fill=c["accent2"], width=S(14))
    d.polygon([(S(cx - 40), S(cy - 40)), (S(cx + 40), S(cy - 40)), (S(cx + 60), S(cy + 60)),
               (S(cx + 150), S(cy + 90)), (S(cx - 150), S(cy + 90)), (S(cx - 60), S(cy + 60))],
              fill=hsv(45, 0.7, 0.75, 245))
    d.rectangle([S(cx - 170), S(cy + 90), S(cx + 170), S(cy + 150)], fill=hsv(c["hue"], 0.5, 0.35, 245))


def m_stopwatch(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 210
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(c["hue"], 0.4, 0.15, 240),
              outline=c["accent"], width=S(12))
    for k in range(12):
        a = k * math.pi / 6
        d.line([(S(cx + (R - 30) * math.cos(a)), S(cy + (R - 30) * math.sin(a))),
                (S(cx + (R - 60) * math.cos(a)), S(cy + (R - 60) * math.sin(a)))], fill=c["soft"], width=S(5))
    a = -math.pi / 2 + c["rot"] * 0.3
    d.line([(S(cx), S(cy)), (S(cx + 140 * math.cos(a)), S(cy + 140 * math.sin(a)))], fill=c["accent2"], width=S(11))
    d.rectangle([S(cx - 40), S(cy - 280), S(cx + 40), S(cy - 240)], fill=c["accent"])
    d.ellipse([S(cx - 22), S(cy - 22), S(cx + 22), S(cy + 22)], fill=c["white"])


def m_whistle(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 260), S(cy - 90), S(cx + 120), S(cy + 90)], radius=S(60),
                        fill=hsv(c["hue"], 0.5, 0.9, 245))
    d.ellipse([S(cx + 10), S(cy - 130), S(cx + 250), S(cy + 110)], fill=hsv(c["hue"], 0.5, 0.9, 245))
    d.ellipse([S(cx + 90), S(cy - 30), S(cx + 170), S(cy + 50)], fill=c["dark"])
    for k in range(3):
        r = 60 + k * 50
        d.arc([S(cx + 250 - r), S(cy - r), S(cx + 250 + r), S(cy + r)], -60, 60, fill=c["accent2"], width=S(8))


def m_leaf(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in (-1, 1):
        pts = []
        for i in range(81):
            a = math.pi * i / 80
            pts.append((S(cx + k * 176 * math.sin(a) * (0.5 + 0.5 * math.sin(a))),
                        S(cy + 90 - 270 * math.cos(a))))
        d.polygon(pts + [(S(cx), S(cy + 90))], fill=hsv(c["hue"], 0.55, 0.85, 235))
    d.line([(S(cx), S(cy - 230)), (S(cx), S(cy + 230))], fill=c["accent2"], width=S(9))
    for i in range(6):
        yy = cy - 150 + i * 56
        for k in (-1, 1):
            d.line([(S(cx), S(yy)), (S(cx + k * (120 - abs(i - 2) * 16)), S(yy + 52))],
                   fill=hsv(c["hue"], 0.45, 1.0, 90), width=S(5))

def m_bowl(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.chord([S(cx - 260), S(cy - 200), S(cx + 260), S(cy + 180)], 0, 180, fill=hsv(c["hue"], 0.4, 0.9, 245))
    d.rectangle([S(cx - 260), S(cy - 200), S(cx + 260), S(cy - 180)], fill=c["accent"])
    d.arc([S(cx - 200), S(cy - 300), S(cx + 200), S(cy - 100)], 25, 155, fill=c["accent2"], width=S(10))
    for k in range(3):
        yy = cy - 340 - k * 55
        d.arc([S(cx - 120 + k * 20), S(yy - 30), S(cx + 60 + k * 20), S(yy + 30)], 200, 340,
              fill=hsv(0, 0, 1, 90), width=S(7))


def m_chili(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    pts_o, pts_i = [], []
    for i in range(41):
        p = i / 40
        x = cx - 60 + 200 * math.sin(p * 1.8)
        y = cy - 210 + p * 430
        w = 66 * (1 - p * 0.7)
        pts_o.append((S(x - w), S(y)))
        pts_i.append((S(x + w), S(y)))
    d.polygon(pts_o + pts_i[::-1], fill=hsv(4, 0.86, 0.95, 250))
    d.line([(S(cx - 60), S(cy - 220)), (S(cx - 20), S(cy - 230)), (S(cx + 20), S(cy - 200)),
            (S(cx + 60), S(cy - 232))], fill=hsv(112, 0.6, 0.8, 250), width=S(16), joint="curve")
    d.line([(S(cx - 60), S(cy - 220)), (S(cx - 70), S(cy - 300))], fill=hsv(112, 0.6, 0.8, 250), width=S(14))

def m_bread(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 260), S(cy - 120), S(cx + 260), S(cy + 170)], radius=S(120),
                        fill=hsv(36, 0.6, 0.92, 245))
    d.rounded_rectangle([S(cx - 230), S(cy - 96), S(cx + 230), S(cy + 148)], radius=S(100),
                        fill=hsv(38, 0.35, 1.0, 200))
    for k in range(4):
        x = cx - 150 + k * 100
        d.arc([S(x - 60), S(cy - 200), S(x + 60), S(cy - 60)], 200, 340, fill=c["accent"], width=S(8))


def m_cup(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.polygon([(S(cx - 210), S(cy - 110)), (S(cx + 160), S(cy - 110)), (S(cx + 100), S(cy + 180)),
               (S(cx - 150), S(cy + 180))], fill=hsv(c["hue"], 0.25, 0.95, 245))
    d.ellipse([S(cx - 210), S(cy - 160), S(cx + 160), S(cy - 60)], fill=hsv(28, 0.55, 0.5, 245))
    d.arc([S(cx + 130), S(cy - 90), S(cx + 300), S(cy + 100)], 280, 100, fill=hsv(c["hue"], 0.25, 0.95, 245),
          width=S(26))
    for k in range(3):
        yy = cy - 240 - k * 60
        d.arc([S(cx - 120 + k * 30), S(yy - 50), S(cx + 60 + k * 30), S(yy + 50)], 200, 340,
              fill=hsv(0, 0, 1, 80), width=S(7))


def m_coin(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    R = 240
    d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(46, 0.86, 0.96, 245))
    d.ellipse([S(cx - R + 24), S(cy - R + 24), S(cx + R - 24), S(cy + R - 24)],
              outline=hsv(44, 0.92, 0.72, 235), width=S(7))
    for k in range(24):
        a = k * math.pi / 12
        d.line([(S(cx + (R - 6) * math.cos(a)), S(cy + (R - 6) * math.sin(a))),
                (S(cx + (R + 14) * math.cos(a)), S(cy + (R + 14) * math.sin(a)))], fill=hsv(46, 0.9, 0.85, 150),
               width=S(5))
    sh.draw_text(d, F_NE, "रु", 150 * SS, (S(cx), S(cy + 30)), fill=hsv(44, 0.95, 0.5, 250), anchor="ms")


def m_chart(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    base = cy + 210
    d.line([(S(cx - 280), S(base)), (S(cx + 280), S(base))], fill=c["soft"], width=S(6))
    heights = [120, 200, 160, 300, 260, 380]
    for k, h in enumerate(heights):
        x = cx - 240 + k * 84
        d.rounded_rectangle([S(x), S(base - h), S(x + 58), S(base)], radius=S(10),
                            fill=hsv(c["hue"], 0.55, 0.5 + k * 0.08, 235))
    pts = [(S(cx - 210 + k * 84), S(base - heights[k] - 40)) for k in range(6)]
    d.line(pts, fill=c["accent2"], width=S(8), joint="curve")
    for p in pts:
        d.ellipse([p[0] - S(9), p[1] - S(9), p[0] + S(9), p[1] + S(9)], fill=(255, 255, 255, 245))


def m_camera(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 280), S(cy - 140), S(cx + 280), S(cy + 190)], radius=S(34),
                        fill=hsv(c["hue"], 0.45, 0.18, 245), outline=c["accent"], width=S(6))
    d.rounded_rectangle([S(cx - 120), S(cy - 200), S(cx + 60), S(cy - 140)], radius=S(16), fill=c["accent"])
    d.ellipse([S(cx - 110), S(cy - 80), S(cx + 110), S(cy + 140)], fill=hsv(c["hue"], 0.5, 0.35, 255))
    d.ellipse([S(cx - 74), S(cy - 44), S(cx + 74), S(cy + 104)], fill=c["accent2"])
    d.ellipse([S(cx - 30), S(cy), S(cx + 30), S(cy + 60)], fill=hsv(c["hue"], 0.5, 0.1, 250))
    d.ellipse([S(cx + 190), S(cy - 100), S(cx + 236), S(cy - 54)], fill=hsv(0, 0.7, 0.9, 220))


def m_film(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.rounded_rectangle([S(cx - 270), S(cy - 190), S(cx + 270), S(cy + 190)], radius=S(20),
                        fill=hsv(c["hue"], 0.4, 0.16, 245), outline=c["accent"], width=S(6))
    for k in range(5):
        y = cy - 160 + k * 80
        d.rectangle([S(cx - 250), S(y), S(cx - 210), S(y + 46)], fill=c["accent2"])
        d.rectangle([S(cx + 210), S(y), S(cx + 250), S(y + 46)], fill=c["accent2"])
    d.line([(S(cx - 170), S(cy - 190)), (S(cx - 120), S(cy + 190))], fill=c["soft"], width=S(4))
    d.line([(S(cx + 170), S(cy - 190)), (S(cx + 120), S(cy + 190))], fill=c["soft"], width=S(4))
    d.polygon([(S(cx - 40), S(cy - 70)), (S(cx - 40), S(cy + 70)), (S(cx + 80), S(cy))], fill=c["accent"])


def m_flag(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    d.line([(S(cx - 196), S(cy - 282)), (S(cx - 196), S(cy + 262))], fill=hsv(215, 0.3, 0.92, 245), width=S(14))
    top, notch, mid, tip, bottom = (cy - 266), (cy - 128), (cy - 96), (cy + 96), (cy + 186)
    poly = [(cx - 184, top), (cx + 128, notch), (cx - 8, mid), (cx + 208, tip), (cx - 184, bottom)]
    d.polygon([(S(x), S(y)) for x, y in poly], fill=hsv(354, 0.86, 0.84, 252))
    d.polygon([(S(cx - 176), S(cy - 226)), (S(cx + 46), S(cy - 138)), (S(cx - 176), S(cy - 104))],
              fill=(252, 253, 255, 246))
    d.ellipse([S(cx - 100), S(cy - 76), S(cx + 12), S(cy + 36)], fill=(252, 253, 255, 246))
    d.ellipse([S(cx - 82), S(cy - 58), S(cx - 6), S(cy + 18)], fill=hsv(354, 0.86, 0.84, 252))
    d.ellipse([S(cx - 166), S(cy + 48), S(cx - 82), S(cy + 132)], fill=hsv(0, 0, 0.96, 150))

def m_pagoda(c):
    d, cx, cy = c["d"], c["cx"], c["cy"]
    for k in range(3):
        w = 250 - k * 62
        y = cy + 190 - k * 130
        d.polygon([(S(cx - w), S(y)), (S(cx + w), S(y)), (S(cx + w * 0.62), S(y - 86)),
                   (S(cx - w * 0.62), S(y - 86))], fill=hsv(20, 0.55, 0.7, 240))
        d.polygon([(S(cx - w * 1.16), S(y - 6)), (S(cx + w * 1.16), S(y - 6)), (S(cx + w), S(y - 34)),
                   (S(cx - w), S(y - 34))], fill=hsv(20, 0.5, 0.95, 245))
        d.rectangle([S(cx - w * 0.42), S(y - 42), S(cx + w * 0.42), S(y)], fill=hsv(25, 0.35, 0.35, 235))
    d.line([(S(cx), S(cy - 200)), (S(cx), S(cy - 280))], fill=c["accent"], width=S(10))
    d.rectangle([S(cx - 330), S(cy + 190), S(cx + 330), S(cy + 226)], fill=hsv(25, 0.4, 0.4, 240))


MOTIFS = {
    "rocket": m_rocket, "atom": m_atom, "planet": m_planet, "satellite": m_satellite,
    "telescope": m_telescope, "chip": m_chip, "phone": m_phone, "gear": m_gear, "wifi": m_wifi,
    "laptop": m_laptop, "flask": m_flask, "dna": m_dna, "magnet": m_magnet, "microscope": m_microscope,
    "globe": m_globe, "mountain": m_mountain, "volcano": m_volcano, "wave": m_wave, "compass": m_compass,
    "paw": m_paw, "fish": m_fish, "bird": m_bird, "bug": m_bug, "footprint": m_footprint,
    "heart": m_heart, "brain": m_brain, "eye": m_eye, "scroll": m_scroll, "pillar": m_pillar,
    "crown": m_crown, "hourglass": m_hourglass, "pyramid": m_pyramid, "book": m_book, "mask": m_mask,
    "note": m_note, "palette": m_palette, "flute": m_flute, "ball": m_ball, "trophy": m_trophy,
    "stopwatch": m_stopwatch, "whistle": m_whistle, "leaf": m_leaf, "bowl": m_bowl, "chili": m_chili,
    "bread": m_bread, "cup": m_cup, "coin": m_coin, "chart": m_chart, "camera": m_camera,
    "film": m_film, "flag": m_flag, "pagoda": m_pagoda,
}

# 4 motif variants per category -> 48 distinct illustrations over 360 scenes
CAT_MOTIFS = {
    1: ["rocket", "planet", "satellite", "telescope"],
    2: ["atom", "flask", "dna", "microscope"],
    3: ["globe", "mountain", "volcano", "compass"],
    4: ["paw", "fish", "bird", "bug"],
    5: ["heart", "brain", "eye", "dna"],
    6: ["scroll", "pyramid", "crown", "hourglass"],
    7: ["chip", "phone", "laptop", "gear"],
    8: ["flag", "mountain", "pagoda", "globe"],
    9: ["mask", "palette", "note", "book"],
    10: ["ball", "trophy", "stopwatch", "whistle"],
    11: ["bowl", "leaf", "cup", "chili"],
    12: ["coin", "chart", "camera", "film"],
}


def draw(hue, motif, seed, rot):
    c = _ctx(hue, seed, rot)
    _deco(c)
    fn = MOTIFS.get(motif, m_atom)
    fn(c)
    return c["lay"].resize((W, H), Image.LANCZOS)
