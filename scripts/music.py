"""Procedural background music for the GK 360 reels (no external audio files).

Energetic 126 BPM bed: four-on-the-floor kick, offbeat hats, sub bass, plucked
arp and a bright bell hook — tuned per chapter hue so the music matches the
visual mood. Rendered to stereo WAV with numpy, then ducked under the voice.
"""
import os, sys, wave
import numpy as np

SR = 44100


def env(n, a=0.005, d=0.12, s=0.0, r=0.06):
    e = np.zeros(n, np.float32)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na, nd, nr = max(1, na), max(1, nd), max(1, nr)
    e[:na] = np.linspace(0, 1, na)
    seg = min(nd, n - na)
    if seg > 0:
        e[na:na + seg] = np.linspace(1, s, seg)
    if n - na - seg > 0:
        tail = n - na - seg
        e[na + seg:] = np.linspace(s, 0, tail) ** 2
    return e


def sine(f, n, ph=0.0):
    t = np.arange(n, dtype=np.float32) / SR
    return np.sin(2 * np.pi * f * t + ph).astype(np.float32)


def saw(f, n):
    t = np.arange(n, dtype=np.float32) / SR
    x = (t * f) % 1.0
    return (2 * x - 1).astype(np.float32)


def noise(n, seed=0):
    return np.random.default_rng(seed).normal(0, 1, n).astype(np.float32)


def kick(dur=0.42, seed=1):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = 118 * np.exp(-t * 26) + 44
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = noise(n, seed) * np.exp(-t * 190) * 0.22
    return np.tanh((body + click) * 1.6).astype(np.float32)


def hat(dur=0.07, seed=2, tone=1.0):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = noise(n, seed) * np.exp(-t * 90)
    x = np.diff(np.concatenate([[0], x])).astype(np.float32)   # high-pass-ish
    return (x * 0.5 * tone).astype(np.float32)


def clap(dur=0.22, seed=3):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = noise(n, seed) * (np.exp(-t * 26) * 0.7 + np.exp(-t * 130) * 0.3)
    return x.astype(np.float32)


def pluck(f, dur=0.34, bright=0.35):
    n = int(dur * SR)
    x = sine(f, n) * 0.7 + saw(f, n) * bright * 0.35 + sine(f * 2, n) * 0.16
    return (x * env(n, 0.004, dur * 0.9)).astype(np.float32)


def bell(f, dur=0.9):
    n = int(dur * SR)
    x = (sine(f, n) * 0.55 + sine(f * 2.01, n) * 0.24 + sine(f * 3.03, n) * 0.12)
    return (x * env(n, 0.006, dur * 0.95, 0.05, 0.12)).astype(np.float32)


def bass(f, dur=0.24):
    n = int(dur * SR)
    x = saw(f, n) * 0.5 + sine(f * 0.5, n) * 0.6
    return (np.tanh(x * 1.5) * env(n, 0.008, dur * 0.8, 0.25)).astype(np.float32)


def whoosh(dur=0.5, seed=5):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = noise(n, seed)
    # sweep the noise with a moving average whose window shrinks
    out = np.zeros(n, np.float32)
    block = 220
    for i in range(0, n, block):
        seg = x[i:i + block]
        k = max(2, int(block * (1 - i / n) + 2))
        conv = np.convolve(seg, np.ones(k, np.float32) / k, mode="same")
        out[i:i + block] = conv[: len(seg)]
    return (out * np.sin(np.pi * t / dur) ** 2 * 0.55).astype(np.float32)


def add(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


# scale per mood: (root, mode)
MODE_ALIASES = {"space": "space", "cool": "cool", "warm": "warm", "bright": "bright"}
MODES = {
    "bright": [0, 2, 4, 7, 9],      # major pentatonic
    "cool": [0, 2, 3, 7, 8],        # minor pentatonic
    "warm": [0, 3, 5, 7, 10],       # bluesy
    "space": [0, 2, 5, 7, 9],       # suspended
}


def make_bed(seconds, root=57, mode="bright", bpm=126, seed=0, drop_first=False):
    """root = MIDI note. Returns stereo float32 (n,2) in -1..1."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    L = np.zeros(n, np.float32)
    R = np.zeros(n, np.float32)
    beat = 60.0 / bpm
    bar = beat * 4
    scale = [root + i for i in MODES[mode]]

    def hz(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    nbars = int(np.ceil(seconds / bar)) + 1
    for b in range(nbars):
        t0 = b * bar
        if t0 >= seconds:
            break
        intro = drop_first and b < 1
        # kick on every beat (four on the floor), skip in intro bar
        if not intro:
            for k in range(4):
                add(L, kick(seed=b * 7 + k), t0 + k * beat)
                add(R, kick(seed=b * 11 + k), t0 + k * beat)
        # offbeat hats + 16th ghost hats
        for k in range(8):
            tt = t0 + k * beat / 2 + beat / 4
            h = hat(seed=b * 13 + k, tone=0.9 if k % 2 else 0.55)
            add(L, h, tt)
            add(R, h * 0.85, tt + 0.004)
        # clap on 2 and 4
        if not intro:
            for k in (1, 3):
                add(L, clap(seed=b * 17 + k), t0 + k * beat)
                add(R, clap(seed=b * 19 + k), t0 + k * beat)
        # bass: 8th note pulse on root/fifth
        for k in range(8):
            step = k if k < 4 else k
            deg = 0 if step % 4 in (0, 2) else (3 if step % 2 else 0)
            note = scale[deg % len(scale)] - 24
            add(L, bass(hz(note), beat * 0.44), t0 + k * beat / 2)
            add(R, bass(hz(note), beat * 0.44) * 0.95, t0 + k * beat / 2)
        # pluck arp in 16ths
        for k in range(16):
            deg = [0, 2, 4, 2, 1, 3, 4, 1][k % 8]
            note = scale[deg % len(scale)] + 12
            p = pluck(hz(note), 0.22, bright=0.28) * 0.42
            pan = 0.35 if k % 2 else 0.65
            add(L, p * (1.0 - pan * 0.4), t0 + k * beat / 4)
            add(R, p * (0.7 + pan * 0.3), t0 + k * beat / 4 + 0.003)
        # bell accent each 2 bars
        if b % 2 == 1:
            note = scale[(b // 2) % len(scale)] + 24
            add(L, bell(hz(note)) * 0.30, t0)
            add(R, bell(hz(note + 12)) * 0.18, t0 + 0.01)

    # side-chained pump for a modern pop feel
    t = np.arange(n, dtype=np.float32) / SR
    pump = 0.78 + 0.22 * (np.cos(2 * np.pi * (t / beat)) * 0.5 + 0.5)
    L *= pump
    R *= pump

    # riser into the loop
    wh = whoosh(0.9, seed=31)
    m = min(len(wh), n)
    L[:m] += wh[:m] * 0.8
    R[:m] += wh[:m] * 0.8
    st = np.stack([L, R], axis=1)
    peak = np.max(np.abs(st)) + 1e-6
    return (st / peak * 0.9).astype(np.float32)


def write_wav(path, stereo):
    data = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "out/music_test.wav"
    write_wav(out, make_bed(8, root=57, mode="bright", seed=1))
    print("wrote", out)
