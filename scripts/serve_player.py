"""Tiny static server + video player for the rendered GK 360 videos.

Serves out/ plus an index page with an HTML5 player (range requests supported),
so the videos can be watched in the browser preview.
"""
import http.server, os, socketserver, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GK 360 — videos</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;background:#080a12;color:#fff;font-family:system-ui,-apple-system,"Noto Sans",sans-serif;display:flex;flex-direction:column;align-items:center}
 h1{font-size:19px;font-weight:700;letter-spacing:.02em;margin:22px 0 4px}
 p.sub{margin:0 0 16px;color:#8b93a7;font-size:13px}
 .wrap{width:min(96vw,430px);display:flex;flex-direction:column;gap:14px;padding-bottom:34px}
 .tabs{display:flex;gap:8px}
 .tab{flex:1;padding:10px 12px;border-radius:999px;border:1px solid #232a3d;background:#111624;color:#c9d0e0;font-size:13px;cursor:pointer}
 .tab.on{background:#1b2440;border-color:#4b6bff;color:#fff}
 video{width:100%;border-radius:16px;background:#000;box-shadow:0 12px 40px rgba(0,0,0,.6)}
 .meta{font-size:12px;color:#8b93a7;display:flex;justify-content:space-between;gap:10px}
 .dl{display:block;text-align:center;padding:15px;border-radius:14px;background:#3d59ff;color:#fff;
     font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(61,89,255,.35)}
 .dl:active{transform:translateY(1px)}
 .row{display:flex;gap:10px}
 .dl2{flex:1;text-align:center;padding:12px 8px;border-radius:12px;border:1px solid #2b3450;background:#121728;
      color:#c9d0e0;font-size:12px;font-weight:600;text-decoration:none}
 a{color:#7d97ff;font-size:12px;text-decoration:none}
</style></head><body>
<h1>GK 360 · नेपाली + English</h1>
<p class="sub">360 scenes · 12 chapters · 1080×1920</p>
<div class="wrap">
  <div class="tabs"><div class="tab on" data-src="gk360_web.mp4">Main · 18:26</div>
  <div class="tab" data-src="gk360_teaser.mp4">360° teaser · 40s</div></div>
  <video id="v" controls playsinline preload="metadata" poster="cover.jpg" src="gk360_web.mp4"></video>
  <div class="meta"><span id="m">main video · 720p web</span><span id="sz">16 MB</span></div>
  <a class="dl" id="dl" href="gk360_web.mp4" download="gk360_main_720p.mp4">⬇ Download this video (720p · 16 MB)</a>
  <div class="row">
    <a class="dl2" href="gk360_main.mp4" download="gk360_main_1080p.mp4">Full HD 1080p · 82 MB</a>
    <a class="dl2" href="gk360_teaser.mp4" download="gk360_teaser_360.mp4">360° teaser · 12 MB</a>
  </div>
  <div class="meta"><span>iPhone/Mac: long-press or right-click → Save video</span></div>
</div>
<script>
 const v=document.getElementById('v'), m=document.getElementById('m');
 document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
   document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
   t.classList.add('on'); v.src=t.dataset.src; m.textContent=t.textContent; v.play();
   document.getElementById('dl').href=t.dataset.src;
   document.getElementById('sz').textContent = t.dataset.src.includes('teaser') ? '12 MB' : '16 MB';
 });
</script></body></html>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urllib.parse.urlsplit(path).path
        if path in ("/", "/index.html"):
            return os.path.join(OUT, "__player.html")
        return os.path.join(OUT, os.path.basename(path))

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "__player.html"), "w").write(PAGE)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"player on http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
