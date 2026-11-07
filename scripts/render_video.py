"""Render GK 360 video: keyframe art + camera drift -> ffmpeg pipe."""
import json, math, os, subprocess, sys, time
from PIL import Image
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M

ROOT = R.ROOT
OUT = os.path.join(ROOT, "out")

PATTERNS = 8


def scene_params(idx, cat):
    """Deterministic per-scene variation."""
    hue = (cat["hue"] + ((idx * 37) % 41) - 20) % 360
    pattern = (idx * 5 + cat["id"] * 3) % PATTERNS
    move = idx % 6
    return hue, pattern, move


def build_scene_layers(fact, cat, idx):
    hue, pattern, move = scene_params(idx, cat)
    bgA = R.build_background(hue, seed=1000 + idx, variant=pattern)
    bgB = R.add_glow(bgA, R.W * 0.5, R.H * 0.4, 900, R.hsv((hue + 30) % 360, 0.7, 1.0), 0.10)
    pool = M.CAT_MOTIFS[cat["id"]]
    motif = pool[idx % len(pool)]
    m1 = M.draw(hue, motif, seed=2000 + idx, rot=idx * 0.7)
    m2 = M.draw(hue, motif, seed=2000 + idx, rot=idx * 0.7 + 1.3)
    # rotate variant B a touch by compositing at slight scale offset
    ov = R.draw_overlay(fact, cat, idx)
    prog = R.draw_progress(idx, cat["hue"])

    A = Image.alpha_composite(bgA, m1)
    B = Image.alpha_composite(bgB, m2)
    if move % 2 == 1:
        A, B = B, A
    return A, B, ov, prog, move


def cam_box(move, p, pad=R.PAD, w=R.W, h=R.H):
    """Return crop box for keyframe image of size pad*w, pad*h."""
    cw, ch = w * 1.02, h * 1.02
    maxx, maxy = pad * w - cw, pad * h - ch
    cxp, cyp = 0.5, 0.5
    e = p * p * (3 - 2 * p)  # smoothstep
    m = {'x': 0, 'y': 0}
    if move == 0:      # slow zoom centre (handled by scale below)
        pass
    elif move == 2:    # pan L->R
        cxp = 0.30 + 0.40 * e
    elif move == 3:    # pan R->L
        cxp = 0.70 - 0.40 * e
    elif move == 4:    # rise
        cyp = 0.62 - 0.26 * e
    elif move == 5:    # descend + drift
        cyp = 0.38 + 0.26 * e
        cxp = 0.42 + 0.16 * e
    x = min(max(maxx * cxp, 0), maxx)
    y = min(max(maxy * cyp, 0), maxy)
    return (int(x), int(y), int(x + cw), int(y + ch))


def render_keyframes(fact, cat, idx):
    A, B, ov, prog, move = build_scene_layers(fact, cat, idx)
    pad = R.PAD
    sz = (int(R.W * pad), int(R.H * pad))
    A2 = A.resize(sz, Image.BICUBIC)
    B2 = B.resize(sz, Image.BICUBIC)
    return A2, B2, ov, prog, move


def frames_for_scene(fact, cat, idx, n):
    A2, B2, ov, prog, move = render_keyframes(fact, cat, idx)
    out = []
    for i in range(n):
        p = i / (n - 1) if n > 1 else 0
        # zoom factor for move 0/1 handled as scale window
        box = cam_box(move, p)
        src = A2.crop(box).resize((R.W, R.H), Image.BILINEAR)
        # crossfade to B in the back half
        if p > 0.55:
            k = (p - 0.55) / 0.45
            box2 = cam_box(move, p, pad=R.PAD * 1.01)
            src2 = B2.crop(box2).resize((R.W, R.H), Image.BILINEAR)
            src = Image.blend(src, src2, min(1.0, k * 0.85))
        fr = Image.alpha_composite(src, ov)
        fr.paste(prog, (0, 0), prog)
        out.append(fr.convert("RGB").tobytes())
    return out


def frames_for_intro(cat, nfacts, n):
    hue = cat["hue"]
    bg = R.build_background(hue, seed=4000 + cat["id"], variant=(cat["id"] * 3) % PATTERNS)
    motif = M.draw(hue, M.CAT_MOTIFS[cat["id"]][0], seed=5000 + cat["id"], rot=cat["id"] * 0.9)
    base = Image.alpha_composite(bg, motif)
    ov = R.draw_intro(cat, nfacts)
    sz = (int(R.W * R.PAD), int(R.H * R.PAD))
    base = base.resize(sz, Image.BICUBIC)
    out = []
    for i in range(n):
        p = i / (n - 1) if n > 1 else 0
        z = 1.06 - 0.05 * p
        cw, ch = R.W * z, R.H * z
        x = (sz[0] - cw) / 2
        y = (sz[1] - ch) / 2
        src = base.crop((int(x), int(y), int(x + cw), int(y + ch))).resize((R.W, R.H), Image.BILINEAR)
        fr = Image.alpha_composite(src, ov)
        out.append(fr.convert("RGB").tobytes())
    return out


def main():
    data = json.load(open(os.path.join(ROOT, "data/facts.json")))
    cats = {c["id"]: c for c in data["categories"]}
    facts = data["facts"]
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0      # facts per category (0 = all)
    name = sys.argv[2] if len(sys.argv) > 2 else "gk360.mp4"
    only_cat = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    cmd = [R.ffmpeg(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{R.W}x{R.H}", "-r", str(R.FPS), "-i", "-",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    nframes = 0
    per_cat = {c: [f for f in facts if f["cat"] == c] for c in cats}
    for cid in sorted(cats):
        if only_cat and cid != only_cat:
            continue
        cat = cats[cid]
        group = per_cat[cid]
        if limit:
            group = group[:limit]
        for blob in frames_for_intro(cat, len(group), R.INTRO_FRAMES):
            proc.stdin.write(blob)
            nframes += 1
        for j, f in enumerate(group):
            for blob in frames_for_scene(f, cat, group.index(f), R.SCENE_FRAMES):
                proc.stdin.write(blob)
                nframes += 1
        el = time.time() - t0
        print(f"cat {cid:02d} done  frames={nframes}  {el/60:.1f} min  "
              f"({nframes/max(el,1e-9):.1f} fps)", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", path, "frames", nframes, "size MB", round(os.path.getsize(path) / 1e6, 1))


if __name__ == "__main__":
    main()
