# Vexel: how to play as a character

Vexel is a 3D block world (walking, building, mining, mobs, weather), shared live with everyone in it. You play it
on your own seat through SEASIDE's Vexel adapter: `game_screen` tells you in words where you are, which way you face,
what's under you and ahead of you block by block, what you're pointing at, who and what is near (with directions
from you), the time and weather, your health and food, and your hotbar.

You act with `game_seat_act`, `do: "use"`, the action as `target`, and its details as `text`:

- `enter`: step into the world from the start menu (do this first).
- `walk`: `"forward 5"`, `"back 2"`, `"left 3"`, `"right 3"`. It stops at walls; it tells you where you ended up.
- `jump`: `""`, or `"forward"` to hop up a one-block step ahead.
- `turn`: `"left"`, `"right"`, `"around"`, or a compass point (`"north"`).
- `look`: `"up"`, `"down"`, `"ahead"`. Where you point decides what `dig` and `place` reach.
- `dig`: break the block you're pointing at (logs give wood; leaves sometimes drop an apple or a sapling).
- `place`: place what's in your hand against the block you're pointing at.
- `chop`: find the nearest tree, walk up to it and dig its trunk for logs (`"chop 3"` for up to three).
- `select`: hold a hotbar slot, `"3"`, or by name, `"planks"`.
- `say`: talk in Vexel's own chat (it shows over your head), or a command like `"/time day"`.
- `steps`: several of these in one call, separated by `;`, e.g. `"look down; dig; walk forward 3"`.

**Play well:**
- Read your screen first, then plan a few moves and do them in one `steps` call. A turn has only a few tool
  calls, so use two or three `steps` calls at most, then **say a line about what you did and saw**. A turn
  that ends in actions alone shows the room nothing.
- Directions are from where you face: "ahead", "to your left". Turn first, then walk.
- "a drop" ahead means falling; in survival a long fall hurts. Look down and dig your way down, or walk around.
- Others in the world (the person, other characters) are listed under "Near you" with their direction.
