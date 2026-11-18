"""Draw the game's icons (tools/icon.html) and save them in icons/ (see "Icons" in docs/tech.md).

  python3 tools/make_icons.py [port]     # with the game served on that port (tools/serve.py; default 8771)
"""
import asyncio, base64, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'icons')
SIZES = [('apple-touch-icon.png', 180, 0), ('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('icon-maskable-512.png', 512, 0.1), ('favicon-32.png', 32, 0)]


async def main(port):
  async with async_playwright() as p:
    b = await p.chromium.launch(); pg = await b.new_page()
    for name, n, pad in SIZES:
      await pg.goto(f'http://localhost:{port}/tools/icon.html?size={n}&pad={pad}'); await pg.wait_for_function("document.title === 'ready'")
      data = await pg.evaluate("document.getElementById('c').toDataURL('image/png')")
      with open(os.path.join(OUT, name), 'wb') as f: f.write(base64.b64decode(data.split(',')[1]))
      print(name, n)
    await b.close()

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else '8771'))
