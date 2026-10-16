# SEAL

A seal is one inscription. Its text is a Bitcoin block height, a dot, and the lowercase word `seal`.

```
0.seal
```

The first inscription of that exact text is the seal of that height. A later copy of the same text is not a seal.

## Rules

- 1.0 The text is `{height}.seal`.
- 1.1 The body matches `^(0|[1-9][0-9]*)\.seal\n?$`. The match is case sensitive.
- 1.2 The height already exists when the inscription is confirmed.
- 1.3 First is first. Inscriptions are read in confirmation order. The earliest inscription of that exact text is the seal.
- 1.4 A later copy of the same text is not a seal.
- 2.0 The picture is not inscribed. It is a function of the block hash, the timestamp, the transaction count, and the height.
- 2.1 There is no parent inscription. Copying this document does not create a seal. Only the text does.

## Text

The body is UTF-8. It matches:

```
^(0|[1-9][0-9]*)\.seal\n?$
```

`0.seal` is the seal of block 0. `00.seal`, `0.Seal`, and `0.seal ` are not seals. One trailing newline is allowed. Nothing else is allowed.

The number is a block height that already exists when the inscription is confirmed. A claim of a later height is not a seal.

## One seal

Index inscriptions in confirmation order. For each exact text, keep the earliest inscription. That inscription is the seal. Every later inscription of the same text is not a seal.

There is no parent inscription and no second family. Copying this document does not create a seal. Only the text does.

## Picture

The picture is computed from the block. It is not stored in the inscription.

Use the block hash, the block timestamp, the transaction count, and the height.

Canvas `0 0 160 160`. Background `#171b22`.

Outer circle, center `80,80`, radius `72`, stroke `#3a2a16`, width `2`. This circle is always present.

Rings follow the first five subsidy eras, the early halvings. `era = floor(height / 210000)`. `rings = max(1, 5 - era)`. Draw `rings - 1` inner circles, center `80,80`, stroke `#c9a227`, width `1.5`, radii `60`, `50`, `40`, `30` from the outside inward. Block 0 has five circles in total. From height `840000` onward, through every later halving, only the outer circle remains.

Arc: `minute = (timestamp % 3600) / 3600`. Start at the top, angle `-π/2`. End at `-π/2 + max(minute, 0.04) × 2π`, clockwise in SVG (sweep flag `1`). Radius `72`. Stroke `#f7931a`, width `3`, round cap. The large-arc flag is `1` when `minute > 0.5`.

Vertical line: clamp the transaction count to `1..7000`. `half = 8 + (count - 1) / 6999 × 54`. Line from `(80, 80 - half)` to `(80, 80 + half)`, stroke `#c9a227`, width `2`.

Squares: take the last 16 hexadecimal characters of the block hash. Each character yields four bits, high bit first. Fill a `9×9` grid from the left five columns, row by row. A bit of `1` lights that cell and its mirror in the right half. Cell column `x`, row `y` is a square of side `10`, centered at `34 + x × 14`, `34 + y × 14`, fill `#f7931a`.

## What an indexer stores

For each seal: the inscription id, the height, and the confirmation order that made it first. A second inscription of the same text gets no seal.
