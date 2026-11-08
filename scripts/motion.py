"""True per-frame animation for the reels (no keyframe camera tricks).

Every frame actually moves:
  * motif rotates, bobs and beat-pulses
  * two parallax particle layers scroll upward
  * ambient glow breathes with the beat
  * speed-light streaks sweep across
  * the fact card slides + fades in, progress bar fills live
Costs ~0.05-0.08 s per frame at 1080x1920.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M

W, H = R.W, R.H
BPM = 126.0
BEAT = 60.0 / BPM


def _particle_strip(hue, seed, count, rmin, rmax, alpha, size=(W, H * 2)):
    rng = np.random.default_rng(seed)
    lay = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for _ in range(count):
        x = rng.uniform(0, size[0])
        y = rng.uniform(0, size[1])
        r = rng.uniform(rmin, rmax)
        a = int(rng.uniform(alpha * 0.35, alpha))
        c = (255, 255, 255, a) if rng.random() > 0.3 else R.hsv(hue + rng.uniform(-25, 25), 0.45, 1.0, a)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    return lay.filter(ImageFilter.GaussianBlur(0.5))


class SceneAnim:
    """Pre-computed assets for one fact's animated shot."""

    def __init__(self, fact, cat, i, hue, motif, pattern, base_seed):
        self.hue = hue
        bg = R.build_background(hue, seed=base_seed, variant=pattern)
        self.bg = R.add_glow(bg, W * 0.5, H * 0.36, 1000, R.hsv((hue + 20) % 360, 0.8, 1.0), 0.16)
        # glow pulse variants (cheap cross-fade)
        self.glow_a = R.add_glow(self.bg, W * 0.5, H * 0.34, 760, R.hsv(hue, 0.75, 1.0), 0.30)
        self.glow_b = R.add_glow(self.bg, W * 0.5, H * 0.34, 760, R.hsv((hue + 40) % 360, 0.75, 1.0), 0.14)
        # parallax particles
        self.p_far = _particle_strip(hue, base_seed + 1, 190, 0.7, 2.0, 150)
        self.p_near = _particle_strip(hue, base_seed + 2, 55, 2.0, 5.0, 105)
        # motif on a square-ish canvas so rotation stays inside bounds
        mw, mh = 760, 1360
        art = M.draw(hue, motif, seed=base_seed + 3, rot=i * 0.5)
        art = art.crop((int(W * 0.5 - mw / 2), int(H * 0.36 - mh / 2) + 120,
                        int(W * 0.5 + mw / 2), int(H * 0.36 + mh / 2) + 120))
        self.motif = art
        self.card = None          # set by caller
        self.card_alphas = {}

    def card_at(self, alpha_step):
        """Card image pre-scaled to one of 8 alpha steps (cached)."""
        if alpha_step not in self.card_alphas:
            a = int(255 * (alpha_step / 7.0))
            c = self.card.copy()
            al = c.split()[-1].point(lambda v: v * a // 255)
            c.putalpha(al)
            self.card_alphas[alpha_step] = c
        return self.card_alphas[alpha_step]


def _scroll(layer, offset):
    """Tile-scroll a tall RGBA layer vertically (seamless because content wraps)."""
    lw, lh = layer.size
    off = int(offset) % lh
    out = Image.new("RGBA", (lw, H), (0, 0, 0, 0))
    out.paste(layer.crop((0, off, lw, min(lh, off + H))), (0, 0))
    rest = H - (min(lh, off + H) - off)
    if rest > 0:
        out.paste(layer.crop((0, 0, lw, rest)), (0, H - rest))
    return out


def render_frame(sc, t, fact_p, beat_phase, card_progress, facts_total, fact_i, cat, show_card=True):
    """t: seconds into the shot. fact_p: 0..1 within the shot."""
    # 1) breathing glow (beat synced)
    pulse = 0.5 + 0.5 * math.sin(beat_phase * 2 * math.pi)
    img = Image.blend(sc.glow_a, sc.glow_b, pulse * 0.85)

    # 2) parallax particles drifting up
    far = _scroll(sc.p_far, 26 * t)
    near = _scroll(sc.p_near, 64 * t + 300)
    img = Image.alpha_composite(img, far)
    img = Image.alpha_composite(img, near)

    # 3) motif: rotate + bob + beat pulse
    bob = 30 * math.sin(t * 1.35)
    scale = 1.0 + 0.055 * pulse
    ang = 5.5 * math.sin(t * 0.55) + 2.0 * math.sin(t * 1.9)
    mw, mh = int(sc.motif.width * scale), int(sc.motif.height * scale)
    m = sc.motif.resize((mw, mh), Image.BILINEAR).rotate(ang, resample=Image.BILINEAR, expand=False)
    mx = int(W / 2 - mw / 2)
    my = int(H * 0.36 - mh / 2 + bob - 40)
    img.alpha_composite(m, dest=(max(0, mx), max(0, my))) if False else img.paste(m, (mx, my), m)

    # 4) speed-light streaks sweeping
    st = (t * 0.55) % 1.0
    streak = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(streak)
    for k in range(3):
        yy = int(((st + k / 3) % 1.0) * (H + 400)) - 200
        sd.line([(0, yy), (W, yy - 120)], fill=R.hsv(sc.hue, 0.3, 1.0, 34), width=3)
    img = Image.alpha_composite(img, streak)

    # 5) fact card slides up + fades in
    if show_card and sc.card is not None:
        e = min(1.0, card_progress * 2.2)
        ease = 1 - (1 - e) ** 3
        step = int(round(ease * 7))
        card = sc.card_at(step)
        dy = int((1 - ease) * 90)
        img = Image.alpha_composite(img, _shift_alpha(card, dy))

    return img


_ALPHA_CARD_CACHE = {}


def _shift_alpha(card, dy):
    key = (id(card), dy)
    if key in _ALPHA_CARD_CACHE:
        return _ALPHA_CARD_CACHE[key]
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(card, (0, dy), card)
    if len(_ALPHA_CARD_CACHE) > 200:
        _ALPHA_CARD_CACHE.clear()
    _ALPHA_CARD_CACHE[key] = out
    return out


def draw_hud(img, cat, fact_i, fact_n, fact_p, label_ne=None, label_en=None):
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    hue = cat["hue"]
    seg_w = (W - 80) / fact_n
    for k in range(fact_n):
        x0 = 40 + k * seg_w
        if k < fact_i:
            d.rounded_rectangle([x0, 26, x0 + seg_w - 8, 32], radius=3, fill=R.hsv(hue, 0.65, 1.0, 250))
        elif k == fact_i:
            d.rounded_rectangle([x0, 26, x0 + seg_w - 8, 32], radius=3, fill=(255, 255, 255, 60))
            d.rounded_rectangle([x0, 26, x0 + (seg_w - 8) * fact_p, 32], radius=3,
                                fill=R.hsv(hue, 0.7, 1.0, 255))
        else:
            d.rounded_rectangle([x0, 26, x0 + seg_w - 8, 32], radius=3, fill=(255, 255, 255, 38))
    # chapter chip
    tw, nw = R.sh.measure(R.F_EN_SB, cat["en"], 24), R.sh.measure(R.F_NE_M, cat["ne"], 27)
    total_w = nw + tw + 88
    x0 = (W - total_w) / 2
    d.rounded_rectangle([x0, 150, x0 + total_w, 208], radius=29, fill=(255, 255, 255, 26),
                        outline=R.hsv(hue, 0.55, 1.0, 120), width=2)
    d.ellipse([x0 + 24, 170, x0 + 40, 186], fill=R.hsv(hue, 0.6, 1.0, 255))
    R.sh.draw_text(d, R.F_NE_M, cat["ne"], 27, (x0 + 52, 188), fill=(255, 255, 255, 240), anchor="ls")
    R.sh.draw_text(d, R.F_EN_SB, cat["en"], 24, (x0 + 52 + nw + 14, 187),
                   fill=R.hsv(hue, 0.22, 1.0, 200), anchor="ls")
    return Image.alpha_composite(img.convert("RGBA"), ov)
