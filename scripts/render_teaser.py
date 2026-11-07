"""360° teaser: cylindrical projection of a procedurally built GK 'world'.

We paint an equirectangular panorama (simplified: a 360-wide band of themed
columns — space, earth, animals, Nepal ... ), then project it onto a virtual
cylinder and sweep a camera through it, so the frame wraps around the viewer
like a spinning globe.
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M

W, H = R.W, R.H
FPS = 30


def paint_panorama():
    """Equirectangular-style strip: 12 themed zones side by side."""
    data = json.load(open(os.path.join(R.ROOT, "data/facts.json")))
    cats = data["categories"] + [data["categories"][0]]
    PW = 480 * len(cats)          # panorama width
    PH = H
    pano = Image.new("RGBA", (PW, PH), (4, 6, 14, 255))
    d = ImageDraw.Draw(pano)
    for i, cat in enumerate(cats):
        hue = cat["hue"]
        x0 = i * 480
        # zone gradient
        g = R.base_gradient(hue)
        g = R.bg_pattern(g, (i * 5) % 8, hue, 900 + i)
        for k in range(3):
            g = R.add_glow(g, (i * 0.37 + k * 0.29) * W, (0.18 + 0.3 * k) * H, 520,
                           R.hsv(hue + k * 40, 0.8, 1.0), 0.16)
        pano.paste(g, (x0, 0))
        # motif art shrunk into the zone
        m = M.draw(hue, M.CAT_MOTIFS[cat["id"]][i % 4], seed=7000 + i, rot=i * 0.6)
        mw2 = 690
        m = m.resize((mw2, int(H * mw2 / W)), Image.LANCZOS)
        pano.paste(m, (x0 + 240 - mw2 // 2, int(H * 0.04)), m)
        # label
        d = ImageDraw.Draw(pano)
        R.sh.draw_text(d, R.F_NE, cat["ne"], 44, (x0 + 240, H * 0.62), fill=(255, 255, 255, 245), anchor="ms")
        R.sh.draw_text(d, R.F_EN_SB, cat["en"], 24, (x0 + 240, H * 0.62 + 52),
                       fill=R.hsv(hue, 0.25, 1.0, 210), anchor="ms")
        # vertical divider soft
        d.line([(x0, 0), (x0, PH)], fill=(255, 255, 255, 16), width=2)
    # lift exposure so the sweep reads on phone screens
    arr0 = np.asarray(pano.convert("RGB"), np.float32)
    arr0 = np.clip(arr0 * 1.5 + 8, 0, 255)
    pano = Image.fromarray(arr0.astype(np.uint8), "RGB").convert("RGBA")
    # blend seams
    pano = pano.filter(ImageFilter.GaussianBlur(0.4))
    # panorama already closes on itself: the 13th zone repeats the first
    return pano.convert("RGBA"), 480 * len(data["categories"])


def render_teaser(out_path, seconds=40, sweep=1.0):
    pano, PW = paint_panorama()
    nframes = int(seconds * FPS)
    cmd = [R.ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", out_path]
    import subprocess, time
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    # overlay text
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    R.sh.draw_text(d, R.F_NE, "३६० डिग्री ज्ञान यात्रा", 64, (W / 2, 168), fill=(255, 255, 255, 250), anchor="ms")
    R.sh.draw_text(d, R.F_EN_SB, "A 360° GK JOURNEY", 27, (W / 2, 226), fill=(255, 255, 255, 175), anchor="ms")
    R.sh.draw_text(d, R.F_EN_SB, "12 विषय · 360 तथ्य", 0, (0, 0), fill=(0, 0, 0, 0)) if False else None
    R.sh.draw_text(d, R.F_NE_M, "१२ विषय · ३६० तथ्य", 30, (W / 2, H - 190),
                   fill=(255, 255, 255, 185), anchor="ms")

    # vignette-ish dark bands top/bottom for legibility
    band = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    top = np.clip(1 - yy / 320, 0, 1) ** 1.4
    bot = np.clip((yy - (H - 260)) / 260, 0, 1) ** 1.4
    band[:, :, 3] = np.clip((top + bot) * 165, 0, 255).astype(np.uint8)
    ov = Image.alpha_composite(ov, Image.fromarray(band))

    for i in range(nframes):
        p = i / (nframes - 1)
        ease = p * p * (3 - 2 * p)
        # camera yaw wraps fully around during the clip
        yaw = (sweep * 2 * math.pi) * ease
        # projection: sample panorama horizontally, vertical kept (cylindrical)
        src_w = PW
        shift = int((yaw / (2 * math.pi)) * src_w) % src_w
        strip = pano.crop((0, 0, PW, H))
        # make a wide frame by horizontal sampling centred at shift
        centre = shift
        # build output by column: x -> angle offset
        xs = np.arange(W)
        fov = math.radians(62)          # horizontal FOV
        ang = (xs / W - 0.5) * fov
        # non-linear (cylindrical) x mapping
        ang = np.arctan((xs / W - 0.5) * 2 * math.tan(fov / 2))
        src_x = (centre + ang / (2 * math.pi) * src_w) % src_w
        arr = np.asarray(strip, np.float32)
        xi = src_x.astype(np.int32)
        cols = arr[:, xi]
        # slight barrel-ish vertical squeeze for the 360 feel
        img = Image.fromarray(cols.astype(np.uint8))
        img = img.convert("RGBA")
        # lift exposure for the pano sweep
        arr2 = np.asarray(img.convert("RGB"), np.float32) * 1.12 + 4
        img = Image.fromarray(np.clip(arr2, 0, 255).astype(np.uint8)).convert("RGBA")
        # gentle zoom bounce
        z = 1.04 + 0.03 * math.sin(p * 6)
        cw, ch = W / z, H / z
        img = img.crop((int((W - cw) / 2), int((H - ch) / 2), int((W + cw) / 2), int((H + ch) / 2)))
        img = img.resize((W, H), Image.BILINEAR)
        img = Image.alpha_composite(img, R.vignette_mask(0.55))
        fr = Image.alpha_composite(img, ov)
        # progress arc
        d2 = ImageDraw.Draw(fr)
        d2.arc([W / 2 - 96, H - 118, W / 2 + 96, H + 74], 180, 180 + 360 * p,
               fill=R.hsv(190, 0.55, 1.0, 235), width=7)
        deg = int(360 * p)
        R.sh.draw_text(d2, R.F_EN_SB, f"{deg:03d}°", 30, (W / 2, H - 40), fill=(255, 255, 255, 230), anchor="ms")
        proc.stdin.write(fr.convert("RGB").tobytes())
        if i % 60 == 0:
            print(f"teaser {i}/{nframes} {time.time()-t0:.1f}s", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", out_path, round(os.path.getsize(out_path) / 1e6, 1), "MB")


if __name__ == "__main__":
    os.makedirs(os.path.join(R.ROOT, "out"), exist_ok=True)
    render_teaser(os.path.join(R.ROOT, "out", "gk360_teaser.mp4"), seconds=int(sys.argv[1]) if len(sys.argv) > 1 else 40)
