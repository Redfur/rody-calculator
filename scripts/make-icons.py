"""Генерирует PNG-иконки приложения в public/icons/.

Знак: три горизонтальных отрезка цветов периодов разной длины на фоне --accent.
Запуск: python3 scripts/make-icons.py (нужен Pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw

ACCENT = "#6E2A55"
BARS = ["#9C93EC", "#F07DA1", "#5CC6AE"]  # 1, 2, 3 период (тёмная палитра читается на --accent)
LENGTHS = [1.0, 0.62, 0.34]
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
SS = 4  # суперсэмплинг для сглаживания


def draw(size: int, content: float, rounded: bool) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=ACCENT)
    else:
        d.rectangle((0, 0, s, s), fill=ACCENT)

    box = s * content  # ширина области знака
    x0 = (s - box) / 2
    bar_h = box * 0.17
    gap = box * 0.12
    total_h = 3 * bar_h + 2 * gap
    y = (s - total_h) / 2
    for color, length in zip(BARS, LENGTHS):
        d.rounded_rectangle((x0, y, x0 + box * length, y + bar_h), radius=bar_h / 2, fill=color)
        y += bar_h + gap
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192, 0.6, rounded=True).save(OUT / "icon-192.png", optimize=True)
    draw(512, 0.6, rounded=True).save(OUT / "icon-512.png", optimize=True)
    # maskable: знак внутри безопасной зоны (круг 80 %), фон до краёв
    draw(512, 0.5, rounded=False).save(OUT / "icon-maskable-512.png", optimize=True)
    # iOS не любит прозрачность и скругляет сам
    draw(180, 0.6, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    main()
