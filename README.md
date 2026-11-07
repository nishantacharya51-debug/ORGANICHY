# ORGANICHY — GK 360

Procedurally generated **360-scene Nepali + English general-knowledge video**.

Deliverables live in `out/`:

| file | what it is |
|---|---|
| `gk360_main.mp4` | main video — 12 chapters × 30 facts = **360 distinct scenes**, 1080×1920 (9:16), 3 s per fact, **18:26** |
| `gk360_teaser.mp4` | 40-second **360° panorama sweep** teaser (camera spins a full 360° through a 12-theme world) |
| `cover.jpg` | thumbnail / cover art |

## What "360" means here

1. **360 scenes** — every fact gets its own scene: unique hue, background pattern, illustration
   variant and camera move. No two scenes are identical.
2. **360° teaser** — a procedural equirectangular panorama of the 12 categories is projected
   cylindrically and the camera yaws 0° → 360°, so the world wraps around the viewer.

## Content

`data/facts.json` — 12 categories × 30 facts, each fact hand-written with a Nepali line
(Devanagari) and an English line:

| # | नेपाली | English |
|---|---|---|
| 01 | अन्तरिक्ष | Space |
| 02 | विज्ञान | Science |
| 03 | पृथ्वी र भूगोल | Earth & Geography |
| 04 | जनावर | Animals |
| 05 | मानव शरीर | Human Body |
| 06 | इतिहास | History |
| 07 | प्रविधि | Technology |
| 08 | नेपाल | Nepal |
| 09 | कला र संस्कृति | Arts & Culture |
| 10 | खेलकुद | Sports |
| 11 | खाना र दैनिकी | Food & Daily Life |
| 12 | अर्थ र मनोरञ्जन | Money & Media |

Edit that file and re-render to change facts, categories, or language.

## How it is built (no stock footage, no external video model)

Everything is drawn in code with Pillow/NumPy:

* `scripts/shaping.py` — HarfBuzz + FreeType text shaping, so Devanagari renders correctly
  (conjuncts, matras) even without Raqm. Fonts in `assets/fonts/`.
* `scripts/render.py` — palette/glow/pattern background engine, text cards, chapter cards, HUD.
* `scripts/motifs.py` — 52 hand-coded vector illustrations (rocket, atom, globe, paw, heart,
  scroll, chip, pagoda, trophy, bowl, coin …); each category draws from 4 of them.
* `scripts/render_video.py` — per scene: render 2 keyframes, then animate with a drifting/zooming
  crop + crossfade, pipe raw frames into ffmpeg (H.264, yuv420p, faststart).
* `scripts/render_teaser.py` — panorama painter + cylindrical 360° camera sweep.
* `scripts/make_cover.py` — cover art.

## Re-render

```bash
python3 -m venv .venv && .venv/bin/pip install Pillow numpy uharfbuzz freetype-py imageio-ffmpeg

.venv/bin/python scripts/render_video.py            # full 360-scene video  -> out/gk360_full.mp4
.venv/bin/python scripts/render_video.py 0 part.mp4 8   # only chapter 8
.venv/bin/python scripts/render_teaser.py 40        # 40 s 360° teaser
.venv/bin/python scripts/make_cover.py              # cover.jpg
```

Full render takes roughly 30–40 min on 2 CPU cores (~9 fps of output).
