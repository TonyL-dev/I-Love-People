"""Measure baseline foreground/control token pairs without duplicating their raw colors."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def luminance(color: str) -> float:
    components = [int(color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in components
    ]
    return sum(
        value * weight for value, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True)
    )


def main() -> int:
    stylesheet = (ROOT / "frontend/src/styles/tokens.css").read_text(encoding="utf-8")
    blocks = {
        "light": stylesheet.split(":root {", 1)[1].split("}", 1)[0],
        "dark": stylesheet.split(":root[data-appearance='dark'] {", 1)[1].split("}", 1)[0],
    }
    failures: list[str] = []
    ratios: list[float] = []
    for appearance, block in blocks.items():
        tokens = dict(re.findall(r"--color-([a-z-]+):\s*(#[0-9a-f]{6})", block))
        for background in ["page", "surface"]:
            for foreground in ["text", "text-secondary", "action", "danger", "success", "boundary"]:
                values = sorted([luminance(tokens[background]), luminance(tokens[foreground])])
                ratio = (values[1] + 0.05) / (values[0] + 0.05)
                ratios.append(ratio)
                threshold = 3 if foreground == "boundary" else 4.5
                if ratio < threshold:
                    failures.append(f"{appearance}: {foreground}/{background} {ratio:.2f}:1")
        values = sorted([luminance(tokens["action"]), luminance(tokens["on-action"])])
        ratio = (values[1] + 0.05) / (values[0] + 0.05)
        ratios.append(ratio)
        if ratio < 4.5:
            failures.append(f"{appearance}: primary button {ratio:.2f}:1")
    if failures:
        print("Contrast checks failed: " + "; ".join(failures))
        return 1
    print(f"26 light/dark baseline token pairs passed; minimum {min(ratios):.2f}:1.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
