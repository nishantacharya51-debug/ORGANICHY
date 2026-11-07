"""Split one long narration clip into per-fact segments using silence detection.

Falls back to proportional splitting (by character count) when the detected
silence count does not match the expected segment count.
"""
import json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def load(path):
    import wave
    with wave.open(path) as w:
        n, ch = w.getnframes(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32).reshape(-1, ch).mean(1)
    return a / 32768.0


def write(path, a):
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes())


def decode(src, dst):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", src, "-ar", str(SR), "-ac", "1", dst],
                   check=True)
    return dst


def detect_silences(a, min_gap=0.28, thresh_db=-34.0, frame=0.02):
    hop = int(SR * frame)
    n = len(a) // hop
    rms = np.array([np.sqrt((a[i * hop:(i + 1) * hop] ** 2).mean() + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9)
    quiet = db < thresh_db
    gaps, start = [], None
    for i, q in enumerate(quiet):
        if q and start is None:
            start = i
        elif not q and start is not None:
            dur = (i - start) * frame
            if dur >= min_gap:
                gaps.append((start * frame, i * frame))
            start = None
    if start is not None:
        gaps.append((start * frame, len(quiet) * frame))
    return gaps


def split_even(a, weights, pad=0.05):
    """Split audio at boundaries proportional to weights (character counts)."""
    total = sum(weights)
    out, pos = [], 0
    acc = 0
    for w in weights[:-1]:
        acc += w
        cut = int(len(a) * acc / total)
        out.append(a[pos:cut])
        pos = cut
    out.append(a[pos:])
    return out


def split_dp(a, gaps, weights, pad=0.06, slack=1.6, max_len=14.0):
    """Pick monotonic sentence boundaries with DP (position + gap length score)."""
    dur = len(a) / SR
    total = sum(weights)
    bounds, acc = [], 0.0
    for w in weights[:-1]:
        acc += w
        bounds.append(dur * acc / total)
    centres = [((g[0] + g[1]) / 2, (g[1] - g[0])) for g in gaps]
    n = len(bounds)
    INF = 1e9
    prev_min = [-INF] * n
    dp = [[INF] * len(gaps) for _ in range(n)]
    back = [[-1] * len(gaps) for _ in range(n)]
    for i in range(n):
        lo = bounds[i] - slack
        hi = bounds[i] + slack
        for j, (c, gd) in enumerate(centres):
            if c < lo or c > hi:
                continue
            cost = abs(c - bounds[i]) - 1.2 * gd
            if i == 0:
                dp[i][j] = cost
            else:
                best, arg = INF, -1
                for k in range(j):
                    if dp[i - 1][k] < best:
                        best, arg = dp[i - 1][k], k
                if arg >= 0:
                    dp[i][j] = best + cost
                    back[i][j] = arg
    last = min(range(len(gaps)), key=lambda j: dp[n - 1][j])
    if dp[n - 1][last] >= INF / 2:
        return None
    picks = [last]
    for i in range(n - 1, 0, -1):
        picks.append(back[i][picks[-1]])
    picks = sorted(picks)
    cuts = [int(centres[j][0] * SR) for j in picks]
    out, pos = [], 0
    for c in cuts:
        out.append(a[pos:c])
        pos = c
    out.append(a[pos:])
    trimmed = []
    for s in out:
        idx = np.where(np.abs(s) > 0.012)[0]
        if len(idx):
            s = s[max(0, idx[0] - int(pad * SR)): min(len(s), idx[-1] + int(pad * SR))]
        if len(s) / SR < 1.0 or len(s) / SR > max_len:
            return None
        trimmed.append(s)
    return trimmed


def split_at_gaps(a, gaps, weights, pad=0.06, tol=4.0):
    """Cut at the silence gap closest to each proportionally expected boundary.

    weights = per-segment character counts (used only to guess boundaries).
    Returns None if any boundary has no gap within `tol` seconds.
    """
    if len(gaps) < len(weights) - 1:
        return None
    dur = len(a) / SR
    total = sum(weights)
    bounds, acc = [], 0.0
    for w in weights[:-1]:
        acc += w
        bounds.append(dur * acc / total)
    chosen = []
    for b in bounds:
        best = min(gaps, key=lambda g: abs((g[0] + g[1]) / 2 - b))
        centre = (best[0] + best[1]) / 2
        if abs(centre - b) > tol:
            return None
        if chosen and centre <= chosen[-1]:
            return None
        chosen.append(centre)
    cuts = [int(c * SR) for c in chosen]
    out, pos = [], 0
    for c in cuts:
        out.append(a[pos:c])
        pos = c
    out.append(a[pos:])
    # trim edges
    trimmed = []
    for s in out:
        idx = np.where(np.abs(s) > 0.012)[0]
        if len(idx):
            s = s[max(0, idx[0] - int(pad * SR)): min(len(s), idx[-1] + int(pad * SR))]
        trimmed.append(s)
    return trimmed


def main():
    spec = json.load(open(os.path.join(ROOT, "out", "audio", "_split_plan.json")))
    for item in spec:
        src = decode(os.path.join(ROOT, item["src"]), os.path.join(ROOT, "out", "audio", "_tmp.wav"))
        a = load(src)
        n = len(item["keys"])
        gaps = detect_silences(a)
        parts = split_at_gaps(a, gaps, item["weights"])
        mode = "silence"
        if parts is None:
            parts = split_even(a, item["weights"])
            mode = "proportional"
        tot = sum(len(p) for p in parts) / SR
        print(f'{item["prefix"]}: {len(gaps)} gaps -> {n} parts [{mode}] total {tot:.1f}s')
        for k, seg in zip(item["keys"], parts):
            write(os.path.join(ROOT, "out", "audio", f"{k}.wav"), seg)


if __name__ == "__main__":
    main()
