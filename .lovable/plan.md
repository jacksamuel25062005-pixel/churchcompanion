## Change

In `src/routes/index.tsx`, remove the Almanac `<Link to="/almanac">` tile inside the books grid (the purple card with "Almanac / पंचांग"). Also drop the now-unused `CalendarDays` import.

Leave everything else intact: the `/almanac` route and its code remain, so the page is still reachable directly if needed — only the Home grid tile is removed.