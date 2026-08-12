#!/usr/bin/env python3
"""Build individual mobile-ready Hwatu faces from the approved V2 sources."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


CARD_ROWS = (
    ("m01-bright", "m01-red-poetry", "m01-pi-a", "m01-pi-b"),
    ("m02-bird", "m02-red-poetry", "m02-pi-a", "m02-pi-b"),
    ("m03-bright", "m03-red-poetry", "m03-pi-a", "m03-pi-b"),
    ("m04-bird", "m04-plain-ribbon", "m04-pi-a", "m04-pi-b"),
    ("m05-animal", "m05-plain-ribbon", "m05-pi-a", "m05-pi-b"),
    ("m06-animal", "m06-blue-ribbon", "m06-pi-a", "m06-pi-b"),
    ("m07-boar", "m07-plain-ribbon", "m07-pi-a", "m07-pi-b"),
    ("m08-bright", "m08-bird", "m08-pi-a", "m08-pi-b"),
    ("m09-cup", "m09-blue-ribbon", "m09-pi-a", "m09-pi-b"),
    ("m10-animal", "m10-blue-ribbon", "m10-pi-a", "m10-pi-b"),
    ("m11-bright", "m11-pi-a", "m11-pi-b", "m11-double-pi"),
    ("m12-rain-bright", "m12-animal", "m12-rain-ribbon", "m12-double-pi"),
)

# The supplied 250 x 280 reference contains January-June on the left and
# July-December on the right. These measured boxes retain each red card edge.
ROW_Y = (10, 53, 96, 139, 182, 225)
LEFT_X = (6, 33, 60, 86)
RIGHT_X = (135, 162, 189, 215)
FACE_SIZE = (264, 400)


def finish_face(source: Image.Image) -> Image.Image:
    fitted = ImageOps.fit(source.convert("RGB"), FACE_SIZE, Image.Resampling.LANCZOS)
    fitted = ImageEnhance.Contrast(fitted).enhance(1.08)
    fitted = ImageEnhance.Color(fitted).enhance(1.08)
    return fitted.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))


def build_contact_sheet(faces: list[tuple[str, Image.Image]], output: Path) -> None:
    thumb_size = (99, 150)
    columns = 10
    rows = (len(faces) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 111 + 24, rows * 180 + 42), "#24150f")
    for index, (_, face) in enumerate(faces):
        x = 12 + (index % columns) * 111
        y = 12 + (index // columns) * 180
        thumb = ImageOps.fit(face, thumb_size, Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
    sheet.save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    source_dir = args.source_dir
    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    reference = Image.open(source_dir / "traditional-hwatu-reference.jpg")
    if reference.size != (250, 280):
        raise ValueError(f"Expected the approved 250 x 280 reference, received {reference.size}")

    written: list[tuple[str, Image.Image]] = []
    for month_index, row in enumerate(CARD_ROWS):
        panel_row = month_index % 6
        x_values = LEFT_X if month_index < 6 else RIGHT_X
        y = ROW_Y[panel_row]
        for card_index, card_id in enumerate(row):
            x = x_values[card_index]
            face = finish_face(reference.crop((x, y, x + 27, y + 41)))
            face.save(out_dir / f"{card_id}.png", optimize=True)
            written.append((card_id, face))

    for card_id, filename in (
        ("bonus-2pi-a", "bonus-2pi-a-generated.png"),
        ("bonus-2pi-b", "bonus-2pi-b-generated.png"),
        ("card-back", "card-back-generated.png"),
    ):
        face = finish_face(Image.open(source_dir / filename))
        face.save(out_dir / f"{card_id}.png", optimize=True)
        if card_id != "card-back":
            written.append((card_id, face))

    build_contact_sheet(written, out_dir.parent / "contact-sheet-v2.png")


if __name__ == "__main__":
    main()
