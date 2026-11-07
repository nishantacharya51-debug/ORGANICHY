"""HarfBuzz + FreeType text shaping onto PIL images (Devanagari-safe)."""
import freetype
import uharfbuzz as hb
from PIL import Image, ImageDraw

_FONT_CACHE = {}


def _font(path):
    if path not in _FONT_CACHE:
        face = freetype.Face(path)
        blob = hb.Blob.from_file_path(path)
        hbfont = hb.Font(hb.Face(blob))
        _FONT_CACHE[path] = (face, hbfont)
    return _FONT_CACHE[path]


def shape(path, text, size):
    """Return (advance_width, list of (glyph_id, x, y, cluster)) at pixel `size`."""
    face, hbfont = _font(path)
    upem = face.units_per_EM
    hbfont.scale = (size * 64, size * 64)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    out, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((info.codepoint, x + pos.x_offset / 64.0, pos.y_offset / 64.0, info.cluster))
        x += pos.x_advance / 64.0
    return x, out


def measure(path, text, size):
    return shape(path, text, size)[0]


def wrap(path, text, size, max_width):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if measure(path, trial, size) <= max_width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_text(draw, path, text, size, xy, fill=(255, 255, 255, 255), anchor="ls", max_width=None):
    """Draw shaped text. anchor: l/m/r + s (baseline) or a/m/d (top/middle/bottom-ish)."""
    face, _ = _font(path)
    if max_width:
        lines = wrap(path, text, size, max_width)
    else:
        lines = text.split("\n")
    line_h = int(size * 1.42)
    widths = [measure(path, ln, size) for ln in lines]
    total_w = max(widths) if widths else 0
    hx, vy = anchor[0], anchor[1]
    x0 = xy[0] - (total_w if hx == "r" else total_w / 2 if hx == "m" else 0)
    # vertical: s = baseline of first line; m = centered block; a = top
    block_h = line_h * len(lines)
    if vy == "m":
        y0 = xy[1] - block_h / 2 + size * 0.78
    elif vy == "a":
        y0 = xy[1] + size * 0.78
    else:
        y0 = xy[1]

    face.set_pixel_sizes(0, size)
    for i, ln in enumerate(lines):
        adv, glyphs = shape(path, ln, size)
        lx = x0 + ((total_w - adv) / 2 if hx == "m" else (total_w - adv) if hx == "r" else 0)
        base = y0 + i * line_h
        for gid, gx, gy, _c in glyphs:
            face.load_glyph(gid, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_NORMAL)
            bmp = face.glyph.bitmap
            if bmp.width == 0 or bmp.rows == 0:
                continue
            g = Image.frombytes("L", (bmp.width, bmp.rows), bytes(bmp.buffer))
            left, top = face.glyph.bitmap_left, face.glyph.bitmap_top
            px = int(round(lx + gx + left))
            py = int(round(base - gy - top))
            if fill[3] != 255:
                g = g.point(lambda v: int(v * fill[3] / 255))
            draw._image.paste(Image.new("RGBA", g.size, fill[:3] + (255,)), (px, py), g)
    return total_w, block_h
