"""Server-rendered inline SVG charts. Pure functions: data in, SVG string out.

Colors are applied through CSS classes (vt-s1/vt-s2 for series, vt-sev-* for
severity status colors) defined in static/style.css, so light/dark mode is a
stylesheet concern and the SVG stays theme-agnostic. Native <title> elements
provide hover tooltips without JavaScript.
"""

from __future__ import annotations

import html

BAR_H = 20          # thin marks
ROW_GAP = 10
LABEL_W = 230
VALUE_W = 60
CHART_W = 720
RADIUS = 4          # rounded data-end


def _esc(s) -> str:
    return html.escape(str(s), quote=True)


def _bar_path(x: float, y: float, w: float, h: float, r: float = RADIUS) -> str:
    """Bar anchored square at the baseline (left), rounded at the data end."""
    if w <= r:
        return (f'M{x},{y} h{max(w, 1)} v{h} h-{max(w, 1)} z')
    return (
        f"M{x},{y} h{w - r} a{r},{r} 0 0 1 {r},{r} v{h - 2 * r} "
        f"a{r},{r} 0 0 1 -{r},{r} h-{w - r} z"
    )


def _grid(x0: float, plot_w: float, height: float, max_val: float) -> str:
    """Recessive hairline gridlines at ~4 ticks with axis labels."""
    if max_val <= 0:
        return ""
    ticks = _nice_ticks(max_val)
    parts = []
    for t in ticks:
        x = x0 + plot_w * t / ticks[-1]
        parts.append(f'<line class="vt-grid" x1="{x:.1f}" y1="0" x2="{x:.1f}" y2="{height}"/>')
        parts.append(
            f'<text class="vt-axis" x="{x:.1f}" y="{height + 14}" text-anchor="middle">{_fmt(t)}</text>'
        )
    return "".join(parts)


def _nice_ticks(max_val: float, n: int = 4) -> list[float]:
    import math

    if max_val <= 0:
        return [0, 1]
    raw = max_val / n
    mag = 10 ** math.floor(math.log10(raw))
    step = next(s * mag for s in (1, 2, 2.5, 5, 10) if s * mag >= raw)
    top = step
    while top < max_val:
        top += step
    return [step * i for i in range(int(top / step) + 1)]


def _fmt(v: float) -> str:
    return f"{v:g}"


def hbar_chart(
    rows: list[tuple],
    title: str,
    css_class: str = "vt-s1",
    class_by_label: dict[str, str] | None = None,
    unit: str = "",
) -> str:
    """Horizontal bars: rows are (label, value) or (label, value, tooltip)."""
    if not rows:
        return f'<p class="vt-empty">No data yet for “{_esc(title)}”.</p>'
    max_val = max((r[1] or 0) for r in rows) or 1
    ticks = _nice_ticks(max_val)
    plot_w = CHART_W - LABEL_W - VALUE_W
    height = len(rows) * (BAR_H + ROW_GAP)
    parts = [
        f'<figure class="vt-fig"><figcaption class="vt-title">{_esc(title)}</figcaption>',
        f'<svg role="img" aria-label="{_esc(title)}" viewBox="0 0 {CHART_W} {height + 20}" '
        f'class="vt-chart" preserveAspectRatio="xMinYMin meet">',
        f'<g transform="translate({LABEL_W},0)">{_grid(0, plot_w, height, ticks[-1])}</g>',
    ]
    for i, row in enumerate(rows):
        label, value = row[0], row[1] or 0
        tooltip = row[2] if len(row) > 2 else f"{label}: {_fmt(value)}{unit}"
        y = i * (BAR_H + ROW_GAP) + ROW_GAP / 2
        w = plot_w * value / ticks[-1]
        cls = (class_by_label or {}).get(label, css_class)
        parts.append(
            f'<g><title>{_esc(tooltip)}</title>'
            f'<text class="vt-lab" x="{LABEL_W - 8}" y="{y + BAR_H / 2 + 4}" text-anchor="end">'
            f"{_esc(_truncate(label))}</text>"
            f'<path class="{cls}" d="{_bar_path(LABEL_W, y, w, BAR_H)}"/>'
            f'<text class="vt-val" x="{LABEL_W + w + 6}" y="{y + BAR_H / 2 + 4}">'
            f"{_fmt(value)}{unit}</text></g>"
        )
    parts.append('<line class="vt-baseline" x1="%d" y1="0" x2="%d" y2="%d"/>'
                 % (LABEL_W, LABEL_W, height))
    parts.append("</svg></figure>")
    return "".join(parts)


def paired_hbar_chart(
    rows: list[tuple],
    title: str,
    legend: tuple[str, str] = ("With", "Without"),
) -> str:
    """Two thin bars per row: rows are (label, value_with, value_without, n_with, n_without).
    Series identity: vt-s1 (with), vt-s2 (without); legend always shown."""
    if not rows:
        return f'<p class="vt-empty">No data yet for “{_esc(title)}”.</p>'
    max_val = max(max(r[1] or 0, r[2] or 0) for r in rows) or 1
    ticks = _nice_ticks(max_val)
    plot_w = CHART_W - LABEL_W - VALUE_W
    pair_h = BAR_H * 2 + 2  # 2px surface gap between the pair
    height = len(rows) * (pair_h + ROW_GAP)
    parts = [
        f'<figure class="vt-fig"><figcaption class="vt-title">{_esc(title)}</figcaption>',
        f'<div class="vt-legend">'
        f'<span><i class="vt-swatch vt-s1"></i>{_esc(legend[0])}</span>'
        f'<span><i class="vt-swatch vt-s2"></i>{_esc(legend[1])}</span></div>',
        f'<svg role="img" aria-label="{_esc(title)}" viewBox="0 0 {CHART_W} {height + 20}" '
        f'class="vt-chart" preserveAspectRatio="xMinYMin meet">',
        f'<g transform="translate({LABEL_W},0)">{_grid(0, plot_w, height, ticks[-1])}</g>',
    ]
    for i, (label, v1, v2, n1, n2) in enumerate(rows):
        y = i * (pair_h + ROW_GAP) + ROW_GAP / 2
        w1 = plot_w * (v1 or 0) / ticks[-1]
        w2 = plot_w * (v2 or 0) / ticks[-1]
        parts.append(
            f'<g><text class="vt-lab" x="{LABEL_W - 8}" y="{y + pair_h / 2 + 4}" text-anchor="end">'
            f"{_esc(_truncate(label))}</text>"
            f'<g><title>{_esc(f"{label} — {legend[0].lower()} (n={n1}): {_fmt(v1 or 0)}")}</title>'
            f'<path class="vt-s1" d="{_bar_path(LABEL_W, y, w1, BAR_H)}"/>'
            f'<text class="vt-val" x="{LABEL_W + w1 + 6}" y="{y + BAR_H / 2 + 4}">{_fmt(v1 or 0)}</text></g>'
            f'<g><title>{_esc(f"{label} — {legend[1].lower()} (n={n2}): {_fmt(v2 or 0)}")}</title>'
            f'<path class="vt-s2" d="{_bar_path(LABEL_W, y + BAR_H + 2, w2, BAR_H)}"/>'
            f'<text class="vt-val" x="{LABEL_W + w2 + 6}" y="{y + BAR_H + 2 + BAR_H / 2 + 4}">{_fmt(v2 or 0)}</text></g>'
            f"</g>"
        )
    parts.append('<line class="vt-baseline" x1="%d" y1="0" x2="%d" y2="%d"/>'
                 % (LABEL_W, LABEL_W, height))
    parts.append("</svg></figure>")
    return "".join(parts)


def _truncate(label: str, n: int = 34) -> str:
    label = str(label)
    return label if len(label) <= n else label[: n - 1] + "…"
