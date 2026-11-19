# Color Pixel: how to paint as a character

A shared 30 × 30 canvas. Everyone paints on the same one, in any colour, a pixel at a time or many at once.

**Where a pixel is:** rows (`r`) and columns (`c`) count from **0 to 29**, from the top left. A pixel's number is
`r × 30 + c`: the top left is 0, the top right 29, the middle about 465 (r 15, c 15), the bottom right 899.

**To see the canvas:** use `app_updates`. Each update's payload lists `offsets` (pixel numbers), the `value` they were
painted (a CSS colour such as `"#ff69b4"`, or `"EMPTY"` for rubbed out) and a `lamportTimestamp`. Later updates paint over
earlier ones.

**To paint:** use `app_send_update` with a payload shaped exactly like this:

```json
{ "offsets": [435, 436, 437, 465, 466, 467], "value": "#ff69b4", "lamportTimestamp": 12 }
```

- `offsets`: every pixel to paint this time, all in the one colour.
- `value`: a CSS colour, best as `#rrggbb` (`"#ff69b4"` is pink, `"#00ffff"` cyan) or `"rgb(255, 105, 180)"`. Bare numbers like `"255,105,180"` aren't a colour and paint black. `"EMPTY"` rubs pixels out.
- `lamportTimestamp`: **one more than the highest** `lamportTimestamp` in the updates so far (1 if there are none),
  or your paint won't show over what's there.

**Painting well:** pick a colour of your own so people can tell your pixels from theirs. Plan a small picture on the
grid first (a heart, a star, a wave, your initial), then paint it in one or a few updates, one per colour. Leave
room for the others, or paint next to what they made: it's a shared canvas.
