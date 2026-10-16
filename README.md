<p align="center">
  <img src="0.seal.svg" alt="0.seal, the seal of block 0" width="280">
</p>

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

## Use

Someone inscribes the text of a block height that already exists. The first confirmed inscription of that exact text is the seal of that height. A later copy of the same text is not a seal.

The inscription stays text. A wallet or an explorer that follows the rule keeps the earliest inscription and draws the picture from the block named by the text. The same arrangement is used by Bitmap: the file is text, and the picture is computed.

## Confirmed

Eleven seals were confirmed in block 971633. Each body is `text/plain;charset=utf-8` and matches the rule exactly. The same ids are in [seals.json](seals.json).

- [`0.seal`](https://ordinals.com/inscription/d4f7d96eb1d3ecc621c1d000f0be451d220bdee29921f6d799adb61b86c8e369i0)
- [`1.seal`](https://ordinals.com/inscription/e1e695959e59ab000eb6af55e20c919eb311add6c6b766382faf1e15e5a98911i0)
- [`2.seal`](https://ordinals.com/inscription/daba26fd880c532ad8a75e7a0b310e27d4d13c0ec38d60099dfedec3e061113di0)
- [`3.seal`](https://ordinals.com/inscription/50b1a22bde8822d85579acd6bda227767f5a364244f454f6df382a7cd0bf4e11i0)
- [`4.seal`](https://ordinals.com/inscription/49a5b66a8b651b926d77dc96e1aeff3dd0ee2be23bbb784cf4918fa4d22c6790i0)
- [`5.seal`](https://ordinals.com/inscription/5bbca5d75f8babfed9804778d666e498351d39fa20c75f5abef75a240ae6e83bi0)
- [`6.seal`](https://ordinals.com/inscription/8e748fb44771b5c4334968e09f773c4e4fa5c078b9fd45f0231ec21e5f535de9i0)
- [`210000.seal`](https://ordinals.com/inscription/f274b5c09da295913c0c5186fde3ce5ae7429e82c67793e00f5fdaf3ee139f5ei0)
- [`420000.seal`](https://ordinals.com/inscription/4d5c6853d1d6fd87148ddf40d52ade95688a28a9e2e3de1f61f0a7f0e7cec4dbi0)
- [`630000.seal`](https://ordinals.com/inscription/6f4217488cf01b5a0275461d948ebe8c5f3670a65ac33156fb739a060c254ca5i0)
- [`840000.seal`](https://ordinals.com/inscription/fb4f7e346502e1d8994986f44a52750eb892b30eed63dd1fbbb1d8bec866ec53i0)

## License

You may download this repository, read the specification, and implement it. These files and the seal picture remain the property of .seal. See [LICENSE](LICENSE).
