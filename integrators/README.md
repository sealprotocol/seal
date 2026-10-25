# Seal

A seal is one inscription. Its text is a Bitcoin block height, a dot, and the lowercase word `seal`.

Insert `glyph.js`. That file draws the picture. It is the same drawing as [`js/glyph.js`](../js/glyph.js). A wallet, a scan, and an explorer already know which inscription is first and who holds it. They pass the block in. They do not fetch a picture.

The picture is not inscribed. A later copy of the same text is not a seal and does not receive the picture.

The exact measures are in the [specification](../specification.md). `glyph.js` is that drawing.

## The text

Content type `text/plain;charset=utf-8`. The body is UTF-8 and matches this, and nothing else:

```
^(0|[1-9][0-9]*)\.seal\n?$
```

`0.seal` is the seal of block 0. `00.seal`, `0.Seal`, and `0.seal ` are not seals. One trailing newline is allowed.

The number is a block height that already exists when the inscription is confirmed. A text that names a height still ahead of the chain is not a seal.

## The first

The first is the earliest confirmed inscription of that exact text. The lowest inscription number wins. A later copy is not a seal, on any address.

There is no parent inscription. Copying this note does not create a seal. Only the text does.

## The picture

`glyphSvg` returns the picture of the block named by the text. The block hash, the timestamp, the transaction count, and the height are the inputs. The same inputs always return the same picture.

The rule gives no rank and no score. Every seal has the same rarity.

## The call

This call is the integration. The name and the arguments stay the same on every wallet, every scan, and every explorer. The page around it is theirs: where the body and the block come from, and how the screen shows the picture.

```javascript
import { glyphSvg } from "./glyph.js";

const picture = glyphSvg({
  id: blockHash,
  height,
  timestamp,
  tx_count,
});
```

`id` is the hash of the named block, not the inscription id. `timestamp` is the block time in seconds. `tx_count` is the number of transactions in that block. `height` is the height written in the text.

## Wallet

Insert `glyph.js`.

On the address, and on the first inscription, show the picture in place of the text. On a later copy, show the text. The picture leaves that screen when the inscription moves. Do not fetch an image.

## Scan

Insert the same `glyph.js`. On the address, and on the inscription, follow the wallet. The first inscription shows the picture. A later copy shows the text.

## Explorer

An explorer that draws inserts `glyph.js` and follows the scan.

An explorer that shows text inserts no image. On the page of the first inscription, print one line: this is the seal. On a later copy of the same text, print one line: this is not a seal.

## Marketplace

Insert `glyph.js`. The listing is the first inscription. The picture of that listing is `glyphSvg` of its height. The price is the seller's. Each seal has its own picture. A later copy is not listed as a seal.

## Files

| File | Insert it | Do not insert it |
| --- | --- | --- |
| `glyph.js` | Wallet, scan, an explorer that draws, marketplace | An explorer that shows text only |
