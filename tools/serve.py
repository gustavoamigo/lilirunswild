#!/usr/bin/env python3
"""Tiny static server for the game. No caching, so every reload gets the latest build.

Usage: python3 tools/serve.py [port]     (default 8765)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *a):
        pass


Handler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript"})

if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as srv:
        print(f"Serving {ROOT} on http://0.0.0.0:{PORT}")
        srv.serve_forever()
