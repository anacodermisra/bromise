import base64
from PIL import Image
import numpy as np

src_path = r'C:\Users\Anand\Downloads\Dap Handshake Bromise Logo.png'
img = Image.open(src_path).convert('RGB')
arr = np.array(img, dtype=np.float32)

# Find bounding box
brightness = arr.mean(axis=2)
mask = brightness > 25
coords = np.argwhere(mask)
y0, x0 = coords.min(axis=0)
y1, x1 = coords.max(axis=0)

cx = (x0 + x1) // 2
cy = (y0 + y1) // 2
w, h = x1 - x0, y1 - y0
# Tight breathing room so the dap handshake figures are prominent
side = int(max(w, h) * 1.05)

crop_x0 = max(0, cx - side // 2)
crop_y0 = max(0, cy - side // 2)
crop_x1 = min(img.width, crop_x0 + side)
crop_y1 = min(img.height, crop_y0 + side)

cropped = img.crop((crop_x0, crop_y0, crop_x1, crop_y1))

# Save sizes
cropped.resize((512, 512), Image.Resampling.LANCZOS).save('public/logo.png', 'PNG')
cropped.resize((512, 512), Image.Resampling.LANCZOS).save('public/icon-512.png', 'PNG')
cropped.resize((192, 192), Image.Resampling.LANCZOS).save('public/icon-192.png', 'PNG')
cropped.resize((180, 180), Image.Resampling.LANCZOS).save('public/icon-apple.png', 'PNG')
cropped.resize((32, 32), Image.Resampling.LANCZOS).save('public/favicon-32.png', 'PNG')
cropped.resize((32, 32), Image.Resampling.LANCZOS).save('public/favicon.ico', format='ICO')

with open('public/icon-192.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <rect width="192" height="192" rx="36" fill="#090a0f" />
  <image href="data:image/png;base64,{b64}" width="192" height="192" />
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

print('All icons and favicon.svg generated successfully!')
