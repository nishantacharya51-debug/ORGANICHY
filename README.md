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

## Herne ra download garne

Preview ma player chha (`scripts/serve_player.py`):

```bash
.venv/bin/python scripts/serve_player.py 8080
```

Player page ma:
* **⬇ Download this video (720p · 16 MB)** — `gk360_web.mp4`, phone/social media ka lagi
* **Full HD 1080p · 82 MB** — `gk360_main.mp4`, original quality
* **360° teaser · 12 MB** — `gk360_teaser.mp4`

Tip: phone ma video mathi long-press → "Save video"; desktop ma right-click → "Save video as…"

## Instagram Reels (1:32 each) — `out/reels/`

12 chapter-wise vertical reels, ready to post:

| file | chapter | music mood |
|---|---|---|
| `R01_space.mp4` | अन्तरिक्ष | space (suspended, airy) |
| `R02_science.mp4` | विज्ञान | cool (minor pentatonic) |
| `R03_earth.mp4` | पृथ्वी | bright (major pentatonic) |
| `R04_animals.mp4` | जनावर | warm (bluesy) |
| `R05_body.mp4` | मानव शरीर | cool |
| `R06_history.mp4` | इतिहास | warm |
| `R07_tech.mp4` | प्रविधि | cool |
| `R08_nepal.mp4` | नेपाल | bright |
| `R09_arts.mp4` | कला | warm |
| `R10_sports.mp4` | खेलकुद | bright |
| `R11_food.mp4` | खाना | warm |
| `R12_money.mp4` | अर्थ | bright |

Each: 1080×1920 · 30 fps (source 20 fps) · ~8 MB · 1:32 · beat-driven music bed
(126 BPM, four-on-the-floor kick, offbeat hats, sub bass, arp plucks + bell hook)
generated in `scripts/music.py` — no licensed audio needed.

`R01_space_voiced.mp4` is the **voiceover pilot** (energetic Nepali TTS, 1:13,
7 facts, music ducked -10 dB under the voice) built by `scripts/make_reels.py`
+ `scripts/reel_lib.py` + `scripts/split_voice.py`.

Rebuild:

```bash
.venv/bin/python scripts/split_reels.py      # 12 reels from the main video + music
.venv/bin/python scripts/make_reels.py R1    # voiced reel from out/audio/*.mp3
```

Get everything as a zip from the player page (**Download all 12 reels**) or
`/reels_zip` on the preview URL.

### Voice pipeline status

`R01_space_voiced.mp4` / `R02_science_voiced.mp4` — full voiceover reels (7 facts, hook + CTA).
Shared `common_intro` / `common_outro` clips are reused across chapters; per-fact clips live in
`out/audio/R<n>_f<i>.mp3`. The remaining chapters get their 7 fact clips the same way
(`scripts/make_reels.py R3 --force` after dropping the mp3s in `out/audio/`).

Note: `scripts/split_voice.py` (silence-split a long narration into per-fact clips) is
experimental — comma pauses and clause pauses have the same length, so it is not reliable
enough for unattended use.
