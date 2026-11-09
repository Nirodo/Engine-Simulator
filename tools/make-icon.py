"""Erzeugt build/icon.png (1024 px), build/icon.ico und desktop/icon.png aus Grundformen."""
from PIL import Image, ImageDraw, ImageFilter
import os
S = 1024
root = os.path.join(os.path.dirname(__file__), '..')
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
# Hintergrund: abgerundetes Quadrat mit Verlauf
bg = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(bg)
for y in range(S):
    t = y / S
    d.line([(0, y), (S, y)], fill=(int(18 + 10 * t), int(28 + 8 * t), int(40 + 6 * t), 255))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([24, 24, S - 24, S - 24], radius=200, fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
ice, amber, steel, dark = (140, 210, 239, 255), (245, 166, 35, 255), (190, 198, 208, 255), (12, 16, 20, 255)
cx = S // 2
# Zylinder (Laufbuchse)
d.rounded_rectangle([cx - 230, 170, cx + 230, 640], radius=36, outline=(90, 110, 130, 255), width=22)
# Verbrennung über dem Kolben
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([cx - 170, 170, cx + 170, 330], fill=(255, 150, 40, 200))
img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(28)))
d = ImageDraw.Draw(img)
# Kolben mit Ringen
d.rounded_rectangle([cx - 200, 300, cx + 200, 500], radius=26, fill=steel)
for k in range(3):
    y = 330 + k * 34
    d.rectangle([cx - 200, y, cx + 200, y + 12], fill=(60, 66, 74, 255))
# Pleuel
d.polygon([(cx - 50, 440), (cx + 50, 440), (cx + 130, 760), (cx + 40, 790)], fill=(150, 160, 172, 255))
d.ellipse([cx - 52, 392, cx + 52, 496], fill=(110, 118, 128, 255))
# Kurbelwelle: Kreis mit Zapfen
d.ellipse([cx - 190, 640, cx + 190, 1020 - 70], outline=ice, width=30)
d.ellipse([cx + 30, 730, cx + 170, 870], fill=ice)
d.ellipse([cx - 45, 755, cx + 45, 845], fill=dark)
# Funke
d.polygon([(cx, 120), (cx + 40, 230), (cx + 8, 222), (cx + 30, 300), (cx - 40, 190), (cx - 6, 198)], fill=amber)
img.save(os.path.join(root, 'build', 'icon.png'))
img.resize((512, 512), Image.LANCZOS).save(os.path.join(root, 'desktop', 'icon.png'))
img.save(os.path.join(root, 'build', 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
img.resize((256, 256), Image.LANCZOS).save(os.path.join(root, 'docs', 'icon.png'))
print('ok')
