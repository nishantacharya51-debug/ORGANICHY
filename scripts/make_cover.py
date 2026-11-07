"""Cover art + per-video poster frame for the GK 360 package."""
import json, os, sys
from PIL import Image, ImageDraw
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M


def cover(path):
    data = json.load(open(os.path.join(R.ROOT, "data/facts.json")))
    cats = data["categories"]
    bg = R.build_background(258, seed=777, variant=0)
    bg = R.add_glow(bg, R.W * 0.5, R.H * 0.36, 900, R.hsv(280, 0.8, 1.0), 0.20)
    art = M.draw(258, "planet", seed=778, rot=0.4)
    art = art.crop((0, int(R.H * 0.05), R.W, int(R.H * 0.62))).resize((R.W, int(R.H * 0.57)))
    img = bg.copy()
    img.paste(art, (0, int(R.H * 0.10)), art)

    # ring of category dots
    d = ImageDraw.Draw(img)
    for i, c in enumerate(cats):
        a = -np.pi / 2 + i * 2 * np.pi / len(cats)
        px, py = R.W / 2 + 420 * np.cos(a), R.H * 0.355 + 420 * np.sin(a) * 0.92
        d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=R.hsv(c["hue"], 0.6, 1.0, 230))

    # headline
    R.sh.draw_text(d, R.F_EN_SB, "NEPALI + ENGLISH", 26, (R.W / 2, R.H * 0.075), fill=(255, 255, 255, 170),
                   anchor="ms")
    R.sh.draw_text(d, R.F_EN, "360", 260, (R.W / 2, R.H * 0.215), fill=(255, 255, 255, 255), anchor="ms")
    R.sh.draw_text(d, R.F_NE, "सामान्य ज्ञान", 82, (R.W / 2, R.H * 0.297), fill=(255, 255, 255, 250), anchor="ms")
    R.sh.draw_text(d, R.F_EN_SB, "FACTS  ·  12 CATEGORIES", 30, (R.W / 2, R.H * 0.337), fill=R.hsv(258, 0.25, 1.0, 220),
                   anchor="ms")

    # bottom card
    d.rounded_rectangle([60, R.H * 0.70, R.W - 60, R.H * 0.955], radius=44, fill=(8, 10, 18, 214),
                        outline=(255, 255, 255, 30), width=2)
    R.sh.draw_text(d, R.F_NE, "अन्तरिक्ष · विज्ञान · पृथ्वी · जनावर", 40, (R.W / 2, R.H * 0.745),
                   fill=(255, 255, 255, 240), anchor="ms")
    R.sh.draw_text(d, R.F_NE, "शरीर · इतिहास · प्रविधि · नेपाल", 40, (R.W / 2, R.H * 0.785),
                   fill=(255, 255, 255, 200), anchor="ms")
    R.sh.draw_text(d, R.F_NE, "कला · खेलकुद · खाना · अर्थ", 40, (R.W / 2, R.H * 0.825),
                   fill=(255, 255, 255, 170), anchor="ms")
    d.line([(R.W / 2 - 120, R.H * 0.862), (R.W / 2 + 120, R.H * 0.862)], fill=(255, 255, 255, 60), width=2)
    R.sh.draw_text(d, R.F_EN_SB, "12 वटा अध्याय · ३६० तथ्य · ~३० मिनेट", 30, (R.W / 2, R.H * 0.912),
                   fill=R.hsv(258, 0.3, 1.0, 235), anchor="ms")

    img = Image.alpha_composite(img, R.vignette_mask(0.45))
    img.convert("RGB").save(path, quality=92)
    print("cover", path)


if __name__ == "__main__":
    os.makedirs(os.path.join(R.ROOT, "out"), exist_ok=True)
    cover(os.path.join(R.ROOT, "out", "cover.jpg"))
