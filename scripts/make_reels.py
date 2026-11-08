"""Spin Instagram Reels (1-2 min each) out of the GK 360 content.

Usage:
  python scripts/make_reels.py 1 2 3          # build reels 1,2,3
  python scripts/make_reels.py all            # build every planned reel

Each reel: 7 facts -> intro VO -> facts VO -> outro VO, energetic Nepali voice,
procedural music bed ducked under the voice, 1080x1920 @ 30 fps, ~80 s.
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import motifs as M
import music as MUS
import reel_lib as RL

ROOT = R.ROOT
W, H, FPS = R.W, R.H, 30
OUT = os.path.join(ROOT, "out", "reels")
AUD = os.path.join(ROOT, "out", "audio")
VOICE_FILE = os.path.join(AUD, "%s.mp3")

# ---------------------------------------------------------------- reel plan
# hue -> music mood
MOOD = {1: ("space", 57), 2: ("cool", 55), 3: ("bright", 60), 4: ("warm", 53),
        5: ("cool", 52), 6: ("warm", 50), 7: ("cool", 57), 8: ("bright", 55),
        9: ("warm", 58), 10: ("bright", 58), 11: ("warm", 55), 12: ("bright", 53)}

PLAN = [
    {"id": "R1", "cat": 1, "title": "अन्तरिक्षका ७ अचम्म", "en": "7 SPACE ODDITIES", "pattern": (0, 0)},
    {"id": "R2", "cat": 2, "title": "विज्ञानका ७ झट्का", "en": "7 SCIENCE SHOCKS", "pattern": (1, 0)},
    {"id": "R3", "cat": 3, "title": "पृथ्वीका ७ रहस्य", "en": "7 EARTH SECRETS", "pattern": (0, 4)},
    {"id": "R4", "cat": 4, "title": "जनावरका ७ कुरा", "en": "7 ANIMAL FACTS", "pattern": (1, 3)},
    {"id": "R5", "cat": 5, "title": "शरीरका ७ रहस्य", "en": "7 BODY SECRETS", "pattern": (0, 2)},
    {"id": "R6", "cat": 6, "title": "इतिहासका ७ कथा", "en": "7 HISTORY TALES", "pattern": (1, 5)},
    {"id": "R7", "cat": 7, "title": "प्रविधिका ७ कुरा", "en": "7 TECH FACTS", "pattern": (0, 1)},
    {"id": "R8", "cat": 8, "title": "नेपालका ७ कुरा", "en": "7 NEPAL FACTS", "pattern": (1, 2)},
    {"id": "R9", "cat": 9, "title": "कलाका ७ कुरा", "en": "7 ART FACTS", "pattern": (0, 6)},
    {"id": "R10", "cat": 10, "title": "खेलकुदका ७ कुरा", "en": "7 SPORTS FACTS", "pattern": (1, 7)},
    {"id": "R11", "cat": 11, "title": "खानाका ७ कुरा", "en": "7 FOOD FACTS", "pattern": (0, 3)},
    {"id": "R12", "cat": 12, "title": "पैसाका ७ कुरा", "en": "7 MONEY FACTS", "pattern": (1, 4)},
]
FACTS_PER_REEL = 7
FIRST = 6          # skip first 5 facts (used elsewhere / weaker copy)
STEP = 4           # spread the picks through the chapter
HEADLINE_SEC = 2.0
GAP = 0.35


# ---------------------------------------------------------------- text / script

def pick_facts(cat_facts, offset=0):
    picks, i = [], 0
    while len(picks) < FACTS_PER_REEL and i < len(cat_facts):
        picks.append(cat_facts[(FIRST + offset + i * STEP) % len(cat_facts)])
        i += 1
    return picks


def intro_line(reel, cat):
    return (f"नमस्ते गाइज एन्ड गर्ल्स! आज {reel['title']}। "
            f"पछिसम्म हेर्नुहोला, सातौं तथ्य सबैभन्दा गज्जब छ।")


def fact_line(i, fact, total):
    mark = {0: "पहिलो", 1: "दोस्रो", 2: "तेस्रो", 3: "चौथो", 4: "पाँचौं", 5: "छैटौं", 6: "सातौं"}
    tail = " साँच्चै अचम्मको कुरा है।" if i == total - 1 else ""
    return f"{mark[i]} तथ्य — {fact['ne']}{tail}"


def outro_line():
    return "कस्तो लाग्यो? कमेन्टमा भन्नुहोला, र अरूलाई पनि सेयर गर्नुहोला। धन्यवाद!"


# ---------------------------------------------------------------- audio

def voice_path(key):
    return VOICE_FILE % key


def decode_to_wav(src, dst):
    if os.path.exists(dst):
        return dst
    subprocess.run([R.ffmpeg(), "-y", "-loglevel", "error", "-i", src,
                    "-ar", str(MUS.SR), "-ac", "1", dst], check=True)
    return dst


def load_wav_mono(path):
    with wave.open(path) as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != MUS.SR:
        a = np.interp(np.linspace(0, len(a), int(len(a) * MUS.SR / sr)),
                      np.arange(len(a)), a).astype(np.float32)
    return a


def trim_silence(a, thresh=0.012, pad=0.06):
    idx = np.where(np.abs(a) > thresh)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(pad * MUS.SR))
    e = min(len(a), idx[-1] + int(pad * MUS.SR))
    return a[s:e]


SHARED = {"intro": "common_intro", "outro": "common_outro"}


def pick_voice_key(kind, reel_id, idx, available):
    """Prefer reel-specific clip, fall back to the shared intro/outro."""
    cands = ([f"{reel_id}_{kind}"] if kind in ("intro", "outro") else [f"{reel_id}_f{idx}"])
    if kind in SHARED:
        cands.append(SHARED[kind])
    for c in cands:
        if c in available:
            return c
    return cands[0]


def build_timeline(reel, cat, facts, available):
    segs = [("intro", intro_line(reel, cat), None, {"vo": pick_voice_key("intro", reel["id"], 0, available)})]
    for i, f in enumerate(facts):
        segs.append(("fact", fact_line(i, f, len(facts)), None,
                     {"vo": pick_voice_key("fact", reel["id"], i, available), "fact": f, "i": i}))
    segs.append(("outro", outro_line(), None, {"vo": pick_voice_key("outro", reel["id"], 0, available)}))
    return segs


def measure_segments(segs):
    for s in segs:
        p = voice_path(s[3]["vo"])
        dur = RL.mp3_duration(p)
        s_list = list(s)
        s_list[2] = max(1.2, dur)
        yield tuple(s_list)


def mix_audio(out_path, segs, mood_profile, duck=0.30):
    total = sum(s[2] for s in segs) + GAP * len(segs) + 0.6
    bed = MUS.make_bed(total + 1.0, root=mood_profile[1], mode=MUS.MODE_ALIASES.get(mood_profile[0], "bright"),
                       seed=hash(tuple(segs[0][3].values())) % 9999)
    n = int(total * MUS.SR)
    bed = bed[:n]
    vo = np.zeros(n, np.float32)
    env = np.ones(n, np.float32)
    t = 0.0
    for kind, text, dur, meta in segs:
        p = voice_path(meta["vo"])
        if os.path.exists(p):
            wav = decode_to_wav(p, p.replace(".mp3", ".wav"))
            a = trim_silence(load_wav_mono(wav))
            i = int(t * MUS.SR)
            j = min(n, i + len(a))
            vo[i:j] += a[: j - i]
            # duck music under this voice chunk
            k0, k1 = i, j
            fade = int(0.12 * MUS.SR)
            env[k0:k1] = duck
            env[max(0, k0 - fade):k0] = np.linspace(1.0, duck, min(fade, k0 - max(0, k0 - fade)))
            env[k1:k1 + fade] = np.linspace(duck, 1.0, min(fade, max(0, n - k1)))
        t += dur + GAP
    music = bed * env[:, None]
    v = vo
    # simple limiter
    peak = max(np.abs(music).max(), np.abs(v).max(), 1e-6)
    music = music / peak * 0.72
    v = v / peak * 0.95
    mixst = np.stack([music[:, 0] * 0.9 + v * 0.0, music[:, 1] * 0.9], axis=1)
    both = music + np.stack([v, v], axis=1) * 0.9
    both = np.tanh(both * 1.15) * 0.92
    MUS.write_wav(out_path, both)
    return out_path, total


# ---------------------------------------------------------------- video

CARD_CACHE = {}


def card_for(fact, cat, i):
    key = (fact["ne"], cat["id"], i)
    if key not in CARD_CACHE:
        CARD_CACHE[key] = RL.fact_card_overlay(fact, cat, i)
    return CARD_CACHE[key]


def ui_for(cat, fact_i, fact_n):
    key = ("ui", cat["id"], fact_i, fact_n)
    if key not in CARD_CACHE:
        blank = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        CARD_CACHE[key] = RL.draw_reel_ui(blank, cat, 0, fact_i, fact_n, None, None, "")
    return CARD_CACHE[key]


def render_video(out_path, audio_path, segs, reel, cat, facts):
    total = sum(s[2] for s in segs) + GAP * len(segs) + 0.6
    cmd = [R.ffmpeg(), "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", audio_path,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    pool = M.CAT_MOTIFS[cat["id"]]
    idx = 0
    # timeline -> frames
    t = 0.0
    times = []
    for kind, text, dur, meta in segs:
        times.append((kind, text, dur, meta, t))
        t += dur + GAP

    for kind, text, dur, meta, start in times:
        n = max(1, int(round(dur * FPS)))
        for f in range(n):
            p = f / max(1, n - 1)
            if kind == "fact":
                fact, i = meta["fact"], meta["i"]
                hue = (cat["hue"] + (i * 23) % 40 - 18) % 360
                pat = (reel["pattern"][0] + i) % 8
                img = RL.build_reel_image(cat, 500 + i * 13, fact, len(facts), hue,
                                          pool[i % len(pool)], pat, p, False, i)
                img = Image.alpha_composite(img.convert("RGBA"), card_for(fact, cat, i))
                img = Image.alpha_composite(img, ui_for(cat, i, len(facts)))
            else:
                hue = (cat["hue"] + (7 if kind == "outro" else 0)) % 360
                img = RL.build_reel_image(cat, 900 + idx, {}, len(facts), hue,
                                          pool[(idx + 1) % len(pool)], reel["pattern"][1], p, True, idx)
                ne = reel["title"] if kind == "intro" else "धन्यवाद · धेरै जान्नुहोस्"
                en = reel["en"] if kind == "intro" else "LIKE · SHARE · FOLLOW"
                lab = "GK 360" if kind == "intro" else "GK 360"
                ov = RL.draw_reel_ui(img, cat, 0, 0, len(facts), ne, en, lab)
                img = ov
            proc.stdin.write(img.convert("RGB").tobytes())
        # gap frames (keep music breathing, hold last frame look)
        gn = int(round(GAP * FPS))
        for _ in range(gn):
            proc.stdin.write(img.convert("RGB").tobytes())
        idx += 1
    proc.stdin.close()
    proc.wait()
    return out_path


def main(ids):
    data = json.load(open(os.path.join(ROOT, "data/facts.json")))
    cats = {c["id"]: c for c in data["categories"]}
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(AUD, exist_ok=True)
    todo = [p for p in PLAN if not ids or p["id"] in ids]
    for reel in todo:
        cat = cats[reel["cat"]]
        facts = pick_facts([f for f in data["facts"] if f["cat"] == cat["id"]])
        keys = [f"{reel['id']}_intro"] + [f"{reel['id']}_f{i}" for i in range(len(facts))] + [f"{reel['id']}_outro"]
        # every generated clip (reel-specific + shared intro/outro) can be used
        available = {f[:-4] for f in os.listdir(AUD) if f.endswith(".mp3")}
        segs = build_timeline(reel, cat, facts, available)
        missing = [s[3]["vo"] for s in segs if s[3]["vo"] not in available]
        print(reel["id"], "cat", cat["en"], "| missing voice:", len(missing), "/", len(keys), flush=True)
        if missing and "--force" not in sys.argv:
            print("  -> generate voice first:", ", ".join(missing[:3]), "...")
            continue
        if missing:
            print("  still missing:", missing)
        segs = list(measure_segments(segs))
        wav = os.path.join(OUT, f"{reel['id']}.wav")
        _, total = mix_audio(wav, segs, MOOD[cat["id"]])
        mp4 = os.path.join(OUT, f"{reel['id']}.mp4")
        render_video(mp4, wav, segs, reel, cat, facts)
        print(f"  done {mp4} {total:.1f}s", flush=True)


if __name__ == "__main__":
    ids = [] if (len(sys.argv) < 2 or sys.argv[1] == "all") else sys.argv[1:]
    main(ids)
