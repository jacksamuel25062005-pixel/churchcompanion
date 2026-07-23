## Goal

Shrink the Font Family section in Settings so it takes one row instead of a big 2-column grid of preview cards.

## Current

Font family renders as a grid of large tiles (one per preset), each showing name + "The quick brown fox" preview. Tapping a tile applies instantly. Takes a lot of vertical space.

## Proposed

Replace the grid with a compact single-row control:

- One row showing label "Font family" and the current font's name on the right with a chevron.
- Tap the row → opens a bottom sheet / modal listing all font presets (each rendered in its own typeface, with a check mark on the current one).
- User picks a font → "Apply" button at the bottom of the sheet commits the change and closes. A "Cancel" button discards.
- Sheet uses existing `glass-modal` / `glass-scrim` utilities and `cc-screen-enter` motion for consistency.

Net result: the Settings screen loses the tall preview grid; font switching becomes one tap → pick → Apply.

## Technical notes

- Edit only `src/routes/settings.tsx`.
- Add a small local `FontPickerSheet` component in that file (no new files needed) using a fixed-position overlay + bottom sheet, matching the app's glass style.
- Keep `s.setFontFamily` as the commit call; hold the pending choice in local `useState` until "Apply" is pressed.
- Preserve accessibility: `role="dialog"`, `aria-modal`, focus trap not required for this small sheet but include Esc-to-close and scrim tap-to-close.
- No schema, i18n, or other screens change.
