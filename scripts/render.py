"""GK 360 — procedural scene art + fast keyframe renderer.

Each of the 360 facts gets: unique hue, background pattern, motif layout, and
camera move. Keyframes are rendered once per scene (A/B), then motion comes from
a drifting crop window plus a cross-fade, so per-frame cost stays tiny.
"""
import json, math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shaping as sh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FN = lambda n: os.path.join(ROOT, "assets/fonts", n)
F_NE = FN("NotoSansDevanagari-Bold.ttf")
F_NE_M = FN("NotoSansDevanagari-Medium.ttf")
F_EN = FN("NotoSans-Bold.ttf")
F_EN_R = FN("NotoSans-Regular.ttf")
F_EN_SB = FN("NotoSans-SemiBold.ttf")

W, H = 1080, 1920
SS = 2          # supersample for motif art
FPS = 24
TOTAL = 360
SCENE_FRAMES = 60      # 2.5 s per fact
INTRO_FRAMES = 44      # 1.83 s per category title
PAD = 1.14             # pre-scale factor for camera drift


FFMPEG = None


def ffmpeg():
    global FFMPEG
    if FFMPEG is None:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    return FFMPEG


def hsv(h, s, v, a=255):
    import colorsys
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360, max(0, min(1, s)), max(0, min(1, v)))
    return (int(r * 255), int(g * 255), int(b * 255), a)


def S(v):
    return int(round(v * SS))


# ------------------------------------------------------------------ background

def base_gradient(hue, top_v=0.11, bot_v=0.03):
    top = hsv(hue, 0.58, top_v)
    mid = hsv((hue + 25) % 360, 0.68, bot_v * 2.1)
    bot = hsv((hue + 55) % 360, 0.72, bot_v)
    y = np.linspace(0, 1, H)[:, None]
    arr = np.zeros((H, W, 3), np.float32)
    for i in range(3):
        a = np.where(y < 0.55, top[i] + (mid[i] - top[i]) * (y / 0.55),
                     mid[i] + (bot[i] - mid[i]) * ((y - 0.55) / 0.45))
        arr[:, :, i] = a
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def add_glow(img, cx, cy, r, color, strength=0.5, gamma=2.0):
    """Screen-style soft glow, computed at quarter resolution."""
    sw, sh = W // 4, H // 4
    yy, xx = np.mgrid[0:sh, 0:sw].astype(np.float32)
    d = np.sqrt((xx - cx / 4) ** 2 + (yy - cy / 4) ** 2) / max(1.0, r / 4)
    a = np.clip(1 - d, 0, 1) ** gamma * strength
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8), "L").resize((W, H), Image.BILINEAR),
                   np.float32)[:, :, None] / 255.0
    base = np.asarray(img.convert("RGB"), np.float32)
    col = np.array(color[:3], np.float32)
    out = base + (255 - base) * a * (col / 255.0) * 0.85
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def bg_pattern(img, kind, hue, seed):
    rng = random.Random(seed)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    if kind == 0:      # stars
        for i in range(300):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            r = rng.choice([0.6, 0.8, 1.1, 1.5, 2.1])
            a = int(rng.uniform(70, 245))
            c = (255, 255, 255, a) if rng.random() > 0.22 else hsv(hue + rng.uniform(-25, 25), 0.4, 1, a)
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    elif kind == 1:    # perspective grid
        hy = int(H * 0.70)
        c = hsv(hue, 0.5, 1.0, 46)
        for i in range(-20, 21):
            d.line([(W / 2 + i * 16, hy), (W / 2 + i * (W / 20) * 1.9, H)], fill=c, width=2)
        for k in range(1, 22):
            yy = hy + (H - hy) * (k / 22) ** 2.05
            d.line([(0, yy), (W, yy)], fill=c, width=2)
        d.line([(0, hy), (W, hy)], fill=hsv(hue, 0.55, 1, 90), width=3)
    elif kind == 2:    # radial rays
        cx, cy = W / 2, H * 0.42
        for i in range(44):
            a0 = i * (360 / 44) + rng.uniform(-3, 3)
            al = int(rng.uniform(10, 30))
            d.pieslice([cx - 1900, cy - 1900, cx + 1900, cy + 1900], a0, a0 + 2.6,
                       fill=hsv(hue + 20, 0.5, 1, al))
    elif kind == 3:    # bokeh
        for i in range(26):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            r = rng.uniform(30, 160)
            d.ellipse([x - r, y - r, x + r, y + r],
                      fill=hsv(hue + rng.uniform(-30, 30), 0.55, 0.95, int(rng.uniform(8, 22))))
    elif kind == 4:    # waves
        for k in range(13):
            yy = 90 + k * 150
            amp, per = rng.uniform(18, 42), rng.uniform(260, 460)
            pts = [(x, yy + amp * math.sin(x / per + k)) for x in range(0, W + 12, 12)]
            d.line(pts, fill=hsv(hue + k * 6, 0.45, 1.0, int(rng.uniform(16, 34))), width=3, joint="curve")
    elif kind == 5:    # concentric rings
        cx, cy = W / 2, H * 0.40
        for k in range(16):
            r = 90 + k * 92
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=hsv(hue, 0.5, 1.0, 26), width=2)
    elif kind == 6:    # diagonal streaks
        for k in range(30):
            x0 = rng.uniform(-400, W)
            d.line([(x0, -100), (x0 + 700, H + 100)], fill=hsv(hue + rng.uniform(-15, 15), 0.4, 1.0,
                                                               int(rng.uniform(8, 26))),
                   width=int(rng.uniform(2, 9)))
    elif kind == 7:    # dot lattice
        step = 68
        for j in range(H // step + 2):
            for i in range(W // step + 2):
                x, y = i * step + (step / 2 if j % 2 else 0), j * step
                r = 2.4
                d.ellipse([x - r, y - r, x + r, y + r], fill=hsv(hue, 0.4, 1.0, 34))
    lay = lay.filter(ImageFilter.GaussianBlur(0.7))
    return Image.alpha_composite(img, lay)


def vignette_mask(strength=0.62):
    w, h = W // 4, H // 4
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w * 0.78)) ** 2 + ((yy - h / 2) / (h * 0.80)) ** 2)
    a = np.clip((d - 0.38) / 0.95, 0, 1) ** 1.6 * strength
    big = Image.fromarray((a * 255).astype(np.uint8), "L").resize((W, H), Image.BILINEAR)
    black = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    black.putalpha(big)
    return black


def build_background(hue, seed, variant):
    img = base_gradient(hue)
    rng = random.Random(seed ^ 0x9E37)
    for k in range(3):
        img = add_glow(img, rng.uniform(-100, W + 100), rng.uniform(-100, H * 0.9),
                       rng.uniform(420, 760), hsv(hue + rng.uniform(-50, 50), 0.85, 1.0),
                       rng.uniform(0.10, 0.22))
    img = bg_pattern(img, variant, hue, seed)
    img = add_glow(img, W / 2, H * 0.40, 620, hsv(hue, 0.6, 1.0), 0.16)
    return img


# ------------------------------------------------------------------ motifs

def draw_motif(hue, motif, seed, rot):
    """Central illustration at SS resolution."""
    rng = random.Random(seed)
    lay = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = W / 2, H * 0.40
    accent = hsv(hue, 0.58, 1.0, 255)
    accent2 = hsv((hue + 58) % 360, 0.52, 1.0, 255)
    soft = hsv(hue, 0.40, 1.0, 62)
    white = (245, 247, 255, 238)

    def ring(r, c=soft, wdt=2.5, dashes=0):
        if dashes:
            seg = 360 / dashes
            for i in range(dashes):
                d.arc([S(cx - r), S(cy - r), S(cx + r), S(cy + r)], i * seg, i * seg + seg * 0.5,
                      fill=c, width=S(wdt))
        else:
            d.ellipse([S(cx - r), S(cy - r), S(cx + r), S(cy + r)], outline=c, width=S(wdt))

    # decorative orbit set — varies per scene
    n_orbs = rng.choice([0, 3, 5, 6, 8])
    ring_r = rng.choice([262, 286, 312])
    ring(ring_r, soft, 2.2, rng.choice([0, 18, 26, 34]))
    for k in range(n_orbs):
        a = rot + k * 2 * math.pi / max(1, n_orbs) + rng.random()
        rr = ring_r + rng.uniform(-6, 10)
        px, py = cx + rr * math.cos(a), cy + rr * 0.92 * math.sin(a)
        s = rng.uniform(4, 8)
        d.ellipse([S(px - s), S(py - s), S(px + s), S(py + s)], fill=accent2)

    if motif == "rocket":
        bx, by = cx, cy + 30
        d.polygon([(S(bx), S(by - 280)), (S(bx + 92), S(by - 30)), (S(bx + 92), S(by + 165)),
                   (S(bx - 92), S(by + 165)), (S(bx - 92), S(by - 30))], fill=white)
        d.polygon([(S(bx - 92), S(by + 55)), (S(bx - 172), S(by + 195)), (S(bx - 92), S(by + 172))], fill=accent)
        d.polygon([(S(bx + 92), S(by + 55)), (S(bx + 172), S(by + 195)), (S(bx + 92), S(by + 172))], fill=accent)
        d.ellipse([S(bx - 40), S(by - 130), S(bx + 40), S(by - 46)], outline=accent, width=S(7))
        d.rectangle([S(bx - 46), S(by + 168), S(bx + 46), S(by + 196)], fill=hsv(hue, 0.3, 0.55, 255))
        for k in range(3):
            f = 0.25 + k * 0.25
            rr = 40 * (1 - f * 0.55)
            d.ellipse([S(bx - rr), S(by + 200 + k * 26 - rr * 0.6), S(bx + rr), S(by + 200 + k * 26 + rr * 1.5)],
                      fill=hsv(38 - k * 9, 1.0, 1.0, int(200 - k * 55)))
    elif motif == "atom":
        for k in range(3):
            ang = rot * 0.6 + k * math.pi / 3
            rx, ry = 250, 84
            pts = []
            for i in range(0, 361, 5):
                a = math.radians(i)
                px, py = rx * math.cos(a), ry * math.sin(a)
                pts.append((S(cx + px * math.cos(ang) - py * math.sin(ang)),
                            S(cy + px * math.sin(ang) + py * math.cos(ang))))
            d.line(pts, fill=accent if k != 1 else accent2, width=S(5), joint="curve")
        d.ellipse([S(cx - 46), S(cy - 46), S(cx + 46), S(cy + 46)], fill=accent)
        d.ellipse([S(cx - 20), S(cy - 20), S(cx + 20), S(cy + 20)], fill=hsv(hue, 0.2, 1, 200))
        for k in range(3):
            a = rot * 1.6 + k * 2.1
            px, py = 250 * math.cos(a), 84 * math.sin(a)
            ang = rot * 0.6 + k * math.pi / 3
            gx = cx + px * math.cos(ang) - py * math.sin(ang)
            gy = cy + px * math.sin(ang) + py * math.cos(ang)
            d.ellipse([S(gx - 18), S(gy - 18), S(gx + 18), S(gy + 18)], fill=accent2)
    elif motif == "globe":
        R = 262
        d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(hue, 0.55, 0.14, 190),
                  outline=accent, width=S(6))
        for k in (-0.68, -0.35, 0, 0.35, 0.68):
            yy = cy + k * R
            hw = R * math.sqrt(max(0, 1 - k * k))
            d.line([(S(cx - hw), S(yy)), (S(cx + hw), S(yy))], fill=soft if abs(k) > 0.01 else accent,
                   width=S(3))
        for k in range(6):
            a = rot * 0.4 + k * math.pi / 6
            hw = abs(R * math.cos(a))
            d.arc([S(cx - hw), S(cy - R), S(cx + hw), S(cy + R)], -90, 90, fill=soft, width=S(3))
            d.arc([S(cx - hw), S(cy - R), S(cx + hw), S(cy + R)], 90, 270, fill=soft, width=S(3))
        for k in range(rng.choice([3, 4, 5])):
            ang = rng.uniform(0, 6.28)
            rr = rng.uniform(0.35, 0.75) * R
            px, py = cx + rr * math.cos(ang), cy + rr * 0.8 * math.sin(ang)
            d.ellipse([S(px - 20), S(py - 20), S(px + 20), S(py + 20)], fill=accent2)
    elif motif == "paw":
        for i, (dx, dy, r) in enumerate([(-118, -128, 52), (-42, -168, 54), (42, -168, 54), (118, -128, 52)]):
            d.ellipse([S(cx + dx - r), S(cy + dy - r), S(cx + dx + r), S(cy + dy + r)], fill=white)
        d.ellipse([S(cx - 152), S(cy - 66), S(cx + 152), S(cy + 214)], fill=accent)
        d.ellipse([S(cx - 92), S(cy - 10), S(cx + 92), S(cy + 160)], fill=hsv(hue, 0.35, 0.35, 110))
    elif motif == "heart":
        pts = []
        for i in range(160):
            a = i / 160 * 2 * math.pi
            x = 16 * math.sin(a) ** 3
            y = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
            pts.append((S(cx + x * 15.5), S(cy + y * 15.5)))
        d.polygon(pts, fill=hsv(hue, 0.62, 1.0, 235))
        # pulse / ECG line
        base_y = cy + 10
        ex = []
        for i in range(0, 361):
            x = cx - 210 + i * (420 / 360)
            y = base_y + 120 * (math.exp(-((i - 120) / 12.0) ** 2) - 1.4 * math.exp(-((i - 140) / 9.0) ** 2)
                                + 1.1 * math.exp(-((i - 158) / 12.0) ** 2))
            ex.append((S(x), S(y)))
        d.line(ex, fill=hsv(0, 0, 1, 235), width=S(6), joint="curve")
    elif motif == "scroll":
        d.rounded_rectangle([S(cx - 296), S(cy - 206), S(cx + 296), S(cy + 206)], radius=S(24), fill=white)
        for k in range(7):
            yy = cy - 132 + k * 44
            wdt = 220 if k % 3 == 2 else 250
            d.line([(S(cx - wdt), S(yy)), (S(cx + wdt), S(yy))], fill=hsv(28, 0.75, 0.55, int(rng.uniform(115, 170))),
                   width=S(6))
        for k in (-1, 1):
            d.rounded_rectangle([S(cx + k * 296 - 30), S(cy - 252), S(cx + k * 296 + 30), S(cy + 252)],
                                radius=S(26), fill=hsv(hue, 0.45, 0.85, 245))
        d.line([(S(cx - 250), S(cy - 168)), (S(cx + 120), S(cy - 168))], fill=accent, width=S(8))
    elif motif == "chip":
        d.rounded_rectangle([S(cx - 186), S(cy - 186), S(cx + 186), S(cy + 186)], radius=S(28),
                            fill=hsv(hue, 0.45, 0.16, 240), outline=accent, width=S(6))
        d.rounded_rectangle([S(cx - 84), S(cy - 84), S(cx + 84), S(cy + 84)], radius=S(14),
                            fill=hsv(hue, 0.55, 0.42, 255))
        for k in range(6):
            off = -150 + k * 60
            ln = 74
            d.line([(S(cx - 186 - ln), S(cy + off)), (S(cx - 186), S(cy + off))], fill=accent, width=S(8))
            d.line([(S(cx + 186), S(cy + off)), (S(cx + 186 + ln), S(cy + off))], fill=accent, width=S(8))
            d.line([(S(cx + off), S(cy - 186 - ln)), (S(cx + off), S(cy - 186))], fill=accent2, width=S(8))
            d.line([(S(cx + off), S(cy + 186)), (S(cx + off), S(cy + 186 + ln))], fill=accent2, width=S(8))
        for k in range(4):
            d.line([(S(cx - 60 + k * 40), S(cy - 40)), (S(cx - 60 + k * 40), S(cy + 40))],
                   fill=hsv(hue, 0.4, 0.75, 150), width=S(4))
    elif motif == "flag":
        d.line([(S(cx - 178), S(cy - 258)), (S(cx - 178), S(cy + 246))], fill=hsv(215, 0.35, 0.92, 245), width=S(12))
        pts = [(cx - 168, cy - 244), (cx + 196, cy - 74), (cx + 12, cy - 74), (cx + 236, cy + 140), (cx - 168, cy + 140)]
        d.polygon([(S(x), S(y)) for x, y in pts], fill=hsv(354, 0.84, 0.90, 250))
        d.polygon([(S(cx - 160), S(cy - 190)), (S(cx + 66), S(cy - 104)), (S(cx - 160), S(cy - 68))],
                  fill=(255, 255, 255, 245))
        d.ellipse([S(cx - 62), S(cy + 4), S(cx + 46), S(cy + 112)], fill=(255, 255, 255, 245))
        d.ellipse([S(cx - 44), S(cy + 22), S(cx + 28), S(cy + 94)], fill=hsv(354, 0.8, 0.9, 250))
        d.ellipse([S(cx - 150), S(cy + 30), S(cx - 74), S(cy + 106)], fill=hsv(0, 0, 0.95, 170))
    elif motif == "mask":
        d.ellipse([S(cx - 208), S(cy - 244), S(cx + 208), S(cy + 244)], fill=hsv(hue, 0.45, 0.92, 240))
        d.chord([S(cx - 208), S(cy - 244), S(cx + 208), S(cy + 244)], 200, 340, fill=hsv((hue + 30) % 360, 0.6, 0.75, 235))
        for k in (-1, 1):
            d.ellipse([S(cx + k * 78 - 62), S(cy - 96), S(cx + k * 78 + 62), S(cy + 26)], fill=hsv(0, 0, 0.07, 245))
            d.ellipse([S(cx + k * 78 - 22), S(cy - 58), S(cx + k * 78 + 22), S(cy - 14)], fill=white)
        d.polygon([(S(cx), S(cy - 30)), (S(cx - 30), S(cy + 54)), (S(cx + 30), S(cy + 54))], fill=hsv(hue, 0.5, 0.6, 230))
        d.arc([S(cx - 96), S(cy + 74), S(cx + 96), S(cy + 190)], 200, 340, fill=hsv(0, 0, 0.08, 240), width=S(14))
        for i in range(9):
            a = math.pi + i * math.pi / 8
            d.line([(S(cx + 212 * math.cos(a)), S(cy + 246 * math.sin(a))),
                    (S(cx + 288 * math.cos(a)), S(cy + 330 * math.sin(a)))], fill=accent, width=S(9))
    elif motif == "ball":
        R = 238
        d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=(248, 249, 252, 245))
        for k in range(7):
            a0 = k * 360 / 7 + rot * 0.3
            d.pieslice([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], a0, a0 + 22, fill=hsv(hue, 0.75, 0.25, 235))
        for k in range(5):
            a = rot * 0.5 + k * 2 * math.pi / 5
            px, py = cx + R * 0.52 * math.cos(a), cy + R * 0.52 * math.sin(a)
            d.polygon([(S(px + 54 * math.cos(a + i * 2 * math.pi / 5)), S(py + 54 * math.sin(a + i * 2 * math.pi / 5)))
                       for i in range(5)], fill=hsv(0, 0, 0.09, 240))
        d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], outline=accent, width=S(5))
    elif motif == "leaf":
        for k in (-1, 1):
            pts = []
            for i in range(81):
                a = math.pi * i / 80
                pts.append((S(cx + k * 148 * math.sin(a) * (0.55 + 0.45 * math.sin(a))),
                            S(cy + 60 - 218 * math.cos(a))))
            d.line(pts, fill=accent, width=S(7), joint="curve")
        d.line([(S(cx), S(cy - 172)), (S(cx), S(cy + 196))], fill=hsv(hue, 0.62, 0.9, 210), width=S(7))
        for i in range(7):
            yy = cy - 120 + i * 44
            for k in (-1, 1):
                d.line([(S(cx), S(yy)), (S(cx + k * (110 - abs(i - 3) * 12)), S(yy + 46))],
                       fill=soft, width=S(4))
        d.arc([S(cx - 216), S(cy - 100), S(cx + 216), S(cy + 250)], 300, 240, fill=hsv(hue, 0.55, 0.8, 120), width=S(4))
    elif motif == "coin":
        R = 240
        d.ellipse([S(cx - R), S(cy - R), S(cx + R), S(cy + R)], fill=hsv(46, 0.86, 0.96, 245))
        d.ellipse([S(cx - R + 24), S(cy - R + 24), S(cx + R - 24), S(cy + R - 24)],
                  outline=hsv(44, 0.92, 0.72, 235), width=S(7))
        for k in range(24):
            a = k * math.pi / 12
            d.line([(S(cx + (R - 6) * math.cos(a)), S(cy + (R - 6) * math.sin(a))),
                    (S(cx + (R + 14) * math.cos(a)), S(cy + (R + 14) * math.sin(a)))],
                   fill=hsv(46, 0.9, 0.85, 150), width=S(5))
        sh.draw_text(d, F_NE, "रु", 150 * SS, (cx, cy + 54 * SS), fill=hsv(44, 0.95, 0.55, 245), anchor="ms")
        d.arc([S(cx - 150), S(cy - 150), S(cx + 150), S(cy + 150)], 20, 160, fill=hsv(46, 0.3, 1.0, 150), width=S(10))
    return lay.resize((W, H), Image.LANCZOS)


# ------------------------------------------------------------------ text UI

def measure_card(fact, cat):
    pad = 66
    inner = W - 88 - pad * 2
    ne_size = 58
    ne_lines = sh.wrap(F_NE, fact["ne"], ne_size, inner)
    while len(ne_lines) > 5 and ne_size > 40:
        ne_size -= 2
        ne_lines = sh.wrap(F_NE, fact["ne"], ne_size, inner)
    en_size = 32
    en_lines = sh.wrap(F_EN_R, fact["en"], en_size, inner)
    while len(en_lines) > 6 and en_size > 23:
        en_size -= 1
        en_lines = sh.wrap(F_EN_R, fact["en"], en_size, inner)
    ne_lh = int(round(ne_size * 1.46))
    en_lh = int(round(en_size * 1.52))
    h = 42 + 8 + 28 + ne_lh * len(ne_lines) + 30 + 2 + 24 + en_lh * len(en_lines) + 40
    return ne_lines, en_lines, ne_size, en_size, ne_lh, en_lh, h


def draw_overlay(fact, cat, idx):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)

    # --- category chip
    label, nlab = cat["en"], cat["ne"]
    tw, nw = sh.measure(F_EN_SB, label, 25), sh.measure(F_NE_M, nlab, 29)
    total_w = nw + tw + 92
    x0 = (W - total_w) / 2
    d.rounded_rectangle([x0, 62, x0 + total_w, 124], radius=31, fill=(255, 255, 255, 24),
                        outline=hsv(cat["hue"], 0.55, 1.0, 120), width=2)
    d.ellipse([x0 + 26, 84, x0 + 42, 100], fill=hsv(cat["hue"], 0.6, 1.0, 255))
    sh.draw_text(d, F_NE_M, nlab, 29, (x0 + 56, 102), fill=(255, 255, 255, 240), anchor="ls")
    sh.draw_text(d, F_EN_SB, label, 25, (x0 + 56 + nw + 16, 101), fill=hsv(cat["hue"], 0.22, 1.0, 200), anchor="ls")

    # --- index
    num = f"{idx + 1:03d}"
    sh.draw_text(d, F_EN_SB, num, 27, (56, 196), fill=hsv(cat["hue"], 0.25, 1.0, 200), anchor="ls")
    sh.draw_text(d, F_EN_R, f"/ {TOTAL}", 24, (66 + sh.measure(F_EN_SB, num, 27), 196),
                 fill=(255, 255, 255, 110), anchor="ls")

    # --- card
    ne_lines, en_lines, ne_size, en_size, ne_lh, en_lh, card_h = measure_card(fact, cat)
    pad = 66
    cx0, cx1 = 44, W - 44
    y0 = int(min(max(1252 - card_h / 2, 250), H - card_h - 110))
    art_bottom = H * 0.365 + 372          # lowest decorative orbit
    if idx % 4 in (0, 2):
        y0 = max(y0, int(art_bottom + 26))
    y0 = min(y0, H - card_h - 110)
    d.rounded_rectangle([cx0, y0, cx1, y0 + card_h], radius=40, fill=(8, 10, 18, 205),
                        outline=(255, 255, 255, 28), width=2)
    # accent bar
    d.rounded_rectangle([cx0 + pad, y0 + 42, cx0 + pad + 88, y0 + 50], radius=4,
                        fill=hsv(cat["hue"], 0.68, 1.0, 250))
    y = y0 + 42 + 8 + 28
    for ln in ne_lines:
        sh.draw_text(d, F_NE, ln, ne_size, (cx0 + pad, y + ne_size), fill=(255, 255, 255, 252), anchor="ls")
        y += ne_lh
    y += 30
    d.line([(cx0 + pad, y), (cx1 - pad, y)], fill=(255, 255, 255, 42), width=2)
    y += 24
    for ln in en_lines:
        sh.draw_text(d, F_EN_R, ln, en_size, (cx0 + pad, y + en_size), fill=(255, 255, 255, 180), anchor="ls")
        y += en_lh

    # --- footer
    fy = H - 66
    sh.draw_text(d, F_EN_SB, "GK 360", 28, (56, fy), fill=hsv(cat["hue"], 0.18, 1.0, 200), anchor="ls")
    sh.draw_text(d, F_NE_M, "नेपाली + English", 23, (W - 56, fy),
                 fill=(255, 255, 255, 105), anchor="rs")
    return lay


def draw_progress(idx, hue):
    lay = Image.new("RGBA", (W, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rectangle([0, 0, W, 6], fill=(255, 255, 255, 26))
    x = int(W * (idx + 1) / TOTAL)
    d.rectangle([0, 0, x, 6], fill=hsv(hue, 0.65, 1.0, 240))
    return lay


def draw_intro(cat, nfacts):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # scrim so the chapter text stays readable over the motif art
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.sqrt(((xx - W / 2) / (W * 0.98)) ** 2 + ((yy - H * 0.47) / (H * 0.27)) ** 2)
    a = np.clip(1 - dist, 0, 1) ** 0.85
    scrim = Image.new("RGBA", (W, H), (3, 4, 10, 255))
    scrim.putalpha(Image.fromarray((a * 232).astype(np.uint8), "L"))
    lay = Image.alpha_composite(lay, scrim)
    d = ImageDraw.Draw(lay)
    d.rectangle([0, 0, W, 6], fill=hsv(cat["hue"], 0.7, 1.0, 240))
    kh = hsv(cat["hue"], 0.25, 1.0, 210)
    sh.draw_text(d, F_EN_SB, "CHAPTER", 30, (W / 2, H * 0.36), fill=kh, anchor="ms")
    sh.draw_text(d, F_EN_SB, f'{cat["id"]:02d}', 128, (W / 2, H * 0.36 + 132), fill=(255, 255, 255, 255), anchor="ms")
    sh.draw_text(d, F_NE, cat["ne"], 90, (W / 2, H * 0.52), fill=(255, 255, 255, 255), anchor="ms")
    sh.draw_text(d, F_EN_SB, cat["en"], 40, (W / 2, H * 0.52 + 74), fill=hsv(cat["hue"], 0.18, 1.0, 230), anchor="ms")
    d.line([(W / 2 - 90, H * 0.52 + 130), (W / 2 + 90, H * 0.52 + 130)], fill=hsv(cat["hue"], 0.6, 1.0, 200), width=3)
    sh.draw_text(d, F_NE_M, f"{nfacts} तथ्य", 34, (W / 2, H * 0.52 + 196), fill=(255, 255, 255, 175), anchor="ms")
    return lay
