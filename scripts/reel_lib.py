"""Instagram Reels: script -> Nepali voiceover -> music -> animated reel.

Each reel is 6 facts (~1:20), vertical 1080x1920, with:
  * energetic Nepali voiceover (TTS)
  * procedural music bed ducked under the voice
  * word/sentence-synced fact cards, progress bar, chapter branding
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M
import music as MUS

W, H = R.W, R.H
FPS = 30
ROOT = R.ROOT
AUD = os.path.join(ROOT, "out", "audio")


def wav_duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def mp3_duration(path):
    out = subprocess.run([R.ffmpeg(), "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


_ART_CACHE = {}


def scene_art(fact_idx, hue, motif, pattern):
    """Padded, pre-composited art for one shot (cached — this is the slow part)."""
    key = (fact_idx, round(hue, 2), motif, pattern)
    if key in _ART_CACHE:
        return _ART_CACHE[key]
    bg = R.build_background(hue, seed=3000 + fact_idx, variant=pattern)
    base = R.add_glow(bg, W * 0.5, H * 0.38, 900, R.hsv((hue + 25) % 360, 0.8, 1.0), 0.14)
    art = M.draw(hue, motif, seed=4000 + fact_idx, rot=fact_idx * 0.45)
    comp = Image.alpha_composite(base, art)
    frame = comp.resize((int(W * 1.18), int(H * 1.18)), Image.BICUBIC)
    if len(_ART_CACHE) > 24:
        _ART_CACHE.clear()
    _ART_CACHE[key] = frame
    return frame


def build_reel_image(cat, fact_idx, fact, total_in_reel, hue, motif, pattern, p, overlay_head, card_idx):
    """One frame's art. p = 0..1 progress inside the shot (push-in + drift)."""
    frame = scene_art(fact_idx, hue, motif, pattern)
    fw, fh = frame.size
    z = 1.06 + 0.07 * p
    cw, ch = W / z, H / z
    cx = (fw - cw) / 2 + math.sin(p * 3.14) * 16
    cy = (fh - ch) / 2 - 24 * p
    box = (int(cx), int(cy), int(cx + cw), int(cy + ch))
    return frame.crop(box).resize((W, H), Image.BILINEAR)


def draw_reel_ui(img, cat, idx_total, fact_i, fact_n, headline_ne, headline_en, step_label):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    hue = cat["hue"]
    # progress segments (one per fact in this reel)
    seg_w = (W - 80) / fact_n
    for k in range(fact_n):
        x0 = 40 + k * seg_w
        filled = k < fact_i
        cur = k == fact_i
        col = R.hsv(hue, 0.65, 1.0, 250) if (filled or cur) else (255, 255, 255, 40)
        d.rounded_rectangle([x0, 26, x0 + seg_w - 8, 32], radius=3, fill=col)
    # chapter chip
    label, nlab = cat["en"], cat["ne"]
    tw, nw = R.sh.measure(R.F_EN_SB, label, 24), R.sh.measure(R.F_NE_M, nlab, 27)
    total_w = nw + tw + 88
    x0 = (W - total_w) / 2
    d.rounded_rectangle([x0, 150, x0 + total_w, 208], radius=29, fill=(255, 255, 255, 26),
                        outline=R.hsv(hue, 0.55, 1.0, 120), width=2)
    d.ellipse([x0 + 24, 170, x0 + 40, 186], fill=R.hsv(hue, 0.6, 1.0, 255))
    R.sh.draw_text(d, R.F_NE_M, nlab, 27, (x0 + 52, 188), fill=(255, 255, 255, 240), anchor="ls")
    R.sh.draw_text(d, R.F_EN_SB, label, 24, (x0 + 52 + nw + 14, 187),
                   fill=R.hsv(hue, 0.22, 1.0, 200), anchor="ls")

    # big headline (first shot) or fact number
    if headline_ne:
        R.sh.draw_text(d, R.F_EN_SB, step_label, 28, (W / 2, H * 0.135), fill=R.hsv(hue, 0.25, 1.0, 210),
                       anchor="ms")
        R.sh.draw_text(d, R.F_NE, headline_ne, 92, (W / 2, H * 0.60), fill=(255, 255, 255, 255), anchor="ms")
        R.sh.draw_text(d, R.F_EN_SB, headline_en, 34, (W / 2, H * 0.60 + 78),
                       fill=R.hsv(hue, 0.2, 1.0, 225), anchor="ms")

    return Image.alpha_composite(img.convert("RGBA"), ov)


def fact_card_overlay(fact, cat, idx_num):
    """Reuse the main renderer's card for consistency, but bigger for reels."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pad = 62
    inner = W - 88 - pad * 2
    ne_size = 62
    ne_lines = R.sh.wrap(R.F_NE, fact["ne"], ne_size, inner)
    while len(ne_lines) > 5 and ne_size > 44:
        ne_size -= 2
        ne_lines = R.sh.wrap(R.F_NE, fact["ne"], ne_size, inner)
    en_size = 33
    en_lines = R.sh.wrap(R.F_EN_R, fact["en"], en_size, inner)
    while len(en_lines) > 5 and en_size > 25:
        en_size -= 1
        en_lines = R.sh.wrap(R.F_EN_R, fact["en"], en_size, inner)
    ne_lh, en_lh = int(ne_size * 1.45), int(en_size * 1.5)
    card_h = 46 + 8 + 26 + ne_lh * len(ne_lines) + 28 + 2 + 22 + en_lh * len(en_lines) + 40
    cy0 = H - card_h - 210
    d.rounded_rectangle([44, cy0, W - 44, cy0 + card_h], radius=40, fill=(8, 10, 18, 214),
                        outline=(255, 255, 255, 30), width=2)
    d.rounded_rectangle([44 + pad, cy0 + 46, 44 + pad + 84, cy0 + 54], radius=4,
                        fill=R.hsv(cat["hue"], 0.68, 1.0, 250))
    y = cy0 + 46 + 8 + 26
    for ln in ne_lines:
        R.sh.draw_text(d, R.F_NE, ln, ne_size, (44 + pad, y + ne_size), fill=(255, 255, 255, 252), anchor="ls")
        y += ne_lh
    y += 28
    d.line([(44 + pad, y), (W - 44 - pad, y)], fill=(255, 255, 255, 42), width=2)
    y += 22
    for ln in en_lines:
        R.sh.draw_text(d, R.F_EN_R, ln, en_size, (44 + pad, y + en_size), fill=(255, 255, 255, 182), anchor="ls")
        y += en_lh
    return lay


def headline_overlay(ne, en, hue):
    """Big centred title used on intro / outro shots."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([60, H * 0.545, W - 60, H * 0.75], radius=44, fill=(6, 8, 16, 190))
    R.sh.draw_text(d, R.F_NE, ne, 86, (W / 2, H * 0.63), fill=(255, 255, 255, 252), anchor="ms")
    R.sh.draw_text(d, R.F_EN_SB, en, 33, (W / 2, H * 0.685), fill=R.hsv(hue, 0.22, 1.0, 230), anchor="ms")
    R.sh.draw_text(d, R.F_EN_SB, "GK 360", 27, (W / 2, H * 0.735), fill=(255, 255, 255, 130), anchor="ms")
    return lay
