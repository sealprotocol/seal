# SEAL

SEAL is one inscription per Bitcoin block height. The inscription is text. The picture is computed from that block.

The seal of block 0 is the first inscription whose text is exactly:

```
0.seal
```

A later inscription of the same text is not a seal.

## The text

The body matches:

```
^(0|[1-9][0-9]*)\.seal\n?$
```

The number is a block height that already exists when the inscription is confirmed. The full rule for indexers is in [specification.md](specification.md).

## The picture

The picture is not stored in the inscription. It is drawn from the block named by the text.

- The squares are the last 16 hexadecimal characters of the block hash. They fill the left half of a 9×9 grid. The right half is the mirror.
- The orange arc is the minute of the block timestamp, starting from the top of the hour.
- The vertical line is the transaction count, from 1 to 7000.
- The circles follow the block subsidy. Block 0 has five. Each halving removes one, down to one circle from height 840000 on.

The exact measures and colors are in [specification.md](specification.md). The same drawing is in [js/glyph.js](js/glyph.js).

## Order

The specification is fixed first. Then `0.seal` is inscribed. Indexers that follow the rule keep the earliest inscription of each exact text.
