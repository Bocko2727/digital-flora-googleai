from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'images' / 'review'
FILES = [
    'IMG_5512.jpg', 'IMG_5521.jpg', 'IMG_5642.jpg', 'IMG_5763.jpg',
    'IMG_5766.jpg', 'IMG_5776.jpg', 'IMG_5791.jpg'
]

REVIEW.mkdir(parents=True, exist_ok=True)
for name in FILES:
    source = ROOT / name
    destination = REVIEW / name
    if source.exists() and not destination.exists():
        source.rename(destination)
