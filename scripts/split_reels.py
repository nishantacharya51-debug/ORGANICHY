"""Split the full GK 360 video into 12 chapter-wise Instagram Reels (1-2 min each),
each with its own mood-matched procedural music bed.
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R
import music as MUS

ROOT = R.ROOT
OUT = os.path.join(ROOT, "out", "reels")
SRC = os.path.join(ROOT, "out", "gk360_main.mp4")
CH_SEC = 92.2          # intro 1.83 s + 30 facts x 3 s at the final 20 fps timing
MOOD = {1: ("space", 57), 2: ("cool", 55), 3: ("bright", 60), 4: ("warm", 53),
        5: ("cool", 52), 6: ("warm", 50), 7: ("cool", 57), 8: ("bright", 55),
        9: ("warm", 58), 10: ("bright", 58), 11: ("warm", 55), 12: ("bright", 53)}
SLUG = {1: "space", 2: "science", 3: "earth", 4: "animals", 5: "body", 6: "history",
        7: "tech", 8: "nepal", 9: "arts", 10: "sports", 11: "food", 12: "money"}


def main():
    data = json.load(open(os.path.join(ROOT, "data/facts.json")))
    cats = {c["id"]: c for c in data["categories"]}
    os.makedirs(OUT, exist_ok=True)
    tmp_audio = os.path.join(OUT, "_music.wav")
    for cid in sorted(cats):
        slug = SLUG[cid]
        dst = os.path.join(OUT, f"R{cid:02d}_{slug}.mp4")
        mode, root = MOOD[cid]
        MUS.write_wav(tmp_audio, MUS.make_bed(CH_SEC + 1.0, root=root, mode=mode, seed=cid * 7))
        start = (cid - 1) * CH_SEC
        cmd = [R.ffmpeg(), "-y", "-loglevel", "error",
               "-ss", f"{start:.2f}", "-t", f"{CH_SEC:.2f}", "-i", SRC,
               "-i", tmp_audio,
               "-map", "0:v:0", "-map", "1:a:0",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", dst]
        subprocess.run(cmd, check=True)
        mb = os.path.getsize(dst) / 1e6
        print(f"R{cid:02d} {slug:9s} {CH_SEC:.0f}s  {mb:5.1f} MB  music={mode}", flush=True)
    if os.path.exists(tmp_audio):
        os.remove(tmp_audio)


if __name__ == "__main__":
    main()
