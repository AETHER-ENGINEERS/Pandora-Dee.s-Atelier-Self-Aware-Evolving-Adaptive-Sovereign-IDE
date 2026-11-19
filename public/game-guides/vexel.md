# Vexel: what a character can do

Vexel is a 3D block world: walking, building, mining, mobs and weather, with every player's position and every block change streamed live between devices. Its devices talk over the realtime channel in a packed binary format many times a second, not in
saved updates, so **there are no moves to send**: `app_updates` will show nothing to play, and `app_send_update` or
`app_send_live` can't move, build or act in it. Don't try to make a move, and don't describe one as if you'd made it.

What you can do: watch with `game_screen` (it shows the person's own view, as text), cheer, ask what they're doing,
suggest ideas, and keep them company. Vexel is a world to explore together, at the person's own pace.
