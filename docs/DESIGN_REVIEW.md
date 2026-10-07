# ADVERSARY design review and Matrix upgrade

Screenshots live in `docs/design-shots/`, named `before-<width>-<scene>.png` and `after-<width>-<scene>.png` (widths 1440 and 390). Scenes: `01-title`, `02-setup`, `03-map`, `04-briefing`, `05-battle`, `09-reward`, `10-shop`, `13-codex`, `14-achievements`, `15-settings`, `16-result-lost`, `17-result-won`. Regenerate with `SHOT_DIR=... node scripts/scene-design.mjs <prefix> <w> <h>`.

## Review of the original look

**What worked**
- Strong, consistent component language: chunky pixel-font buttons, chip and badge system, colour-coded NIST function and STRIDE tags. Cards, asset tiles and wards read well as a set.
- Clear information architecture on the battle screen (HUD, board, programme/relics/SOC feed, hand). The ward chips and HP bars are crisp.
- Good juice vocabulary already existed (stamps, floaters, banners, toasts).

**What was weak**
- Identity: a blue/violet swirl shader gave a generic "sci-fi dashboard" feel; nothing said hacker or terminal (`before-1440-01-title.png`). The title was a logo and a button stack with no illustration.
- Title screen: floating decoration cards sat under the Tutorial/Guide buttons and the fact ticker, hurting legibility (`before-1440-01-title`, `before-390-01-title`).
- Battle board: large empty areas in the Edge and Corporate zones, and the board never scaled up, only down (`before-1440-05-battle.png`). Card text is 10-10.5px at 1440x900 and truncates on the shop and reward screens (`before-1440-10-shop.png`).
- **Mobile battle was broken** (`before-390-05-battle.png`): the 1fr hand column grew to its content width, pushing End turn and the energy orb off-screen, and below 1150px the third HUD panel was hidden, which removes the **Goal meter and the intent line**, the two things the player most needs to read.
- Map: node boxes were stretched to random sizes. The `.node.battle` class collides with the `.battle` screen container class, so skirmish nodes inherited `flex:1` and grid layout (`before-1440-03-map.png`). Nodes read as empty boxes.
- Briefing and dossier: dense walls of small text with no hierarchy between the story, goal and mitigations (`before-1440-04-briefing`).
- Result and level-up: the level-up overlay and confetti sat on top of result content with low contrast; stat tiles used small blue numerals (`before-1440-16-result-lost`).
- Contrast: `--ink3` (#6f7aa6) on the dark background is about 4.0:1, below AA for small text; card notes and footers used it.
- Performance: the WebGL shader needed a GPU readback stall (console warning in headless), and `backdrop-filter: blur` on every panel, the top bar and modals forced re-blur over an animating background each frame.
- Reduced motion: the old rule set `animation-duration: .001s` without setting iteration count to 1, so infinite animations strobed.
- Inconsistency: emoji in two UI strings, ad-hoc hard-coded blues in about six places, a settings select that rendered with a light native control on a dark page.

## What changed

**Look and feel**
- Phosphor palette. Tokens are in `web/css/tokens.css`; the skin is `web/css/matrix.css`. Scenario themes are still honoured: the legacy default blue theme maps to phosphor green, and any other theme (amber utilities, purple AppSec, teal OT, green banking) keeps its own accent, and the rain, panels, lines and art recolour from it. Red remains adversary and threat, amber goals and warnings. Menus use the Matrix palette until a scenario is chosen.
- **Digital rain** replaces the WebGL swirl (`web/js/bg.js`): canvas 2D, about 30 fps (20 on Low), katakana plus hex plus real ATT&CK IDs (T1078, T1566, M1032...) falling in columns. Detects missing kana glyphs and falls back to hex. Pauses when the tab is hidden, draws a single still frame under reduced motion or Animation off, dims per view (0.2 in battle, 0.8 on title), surges on boss entrance and tints red on hits.
- Terminal touches: blinking caret, typed-in briefing/dossier/title text, decrypt text on technique IDs, banners and headings, scanlines with a slow refresh bar and vignette (no blend modes), panel corner brackets, `//` panel headings, chromatic aberration on button hover and a periodic logo glitch.
- **Original SVG art** (`web/js/art.js`, `web/icons/hood.svg`): a hooded intruder at a laptop on title and loading screens; a headset analyst for the Setup (defender) screen and level-up; a hood icon as the fallback adversary sigil and as a watermark on achievement toasts. About 3 KB each, inline, themed via CSS variables, subtly animated (eye blink, typing hands, code flicker, glow).
- Battle: board may scale up to 1.18x, Goal meter heartbeats from 60% (faster at 85%) with larger numerals and `role="meter"`, shop and reward cards enlarged for text legibility, dark card bodies with higher-contrast text.

**Animation** (all gated by the Animation setting, the OS reduced-motion preference and, for glitch, a Glitch setting)
- Card play: the card flies to its target and dissolves; end of turn sweeps the hand to the deck; deal-in glow.
- Foothold reveal decrypts the technique ID; evict shatters into falling code glyphs with a ripple; ward block and deploy produce shield ripples; asset down glitch-tears the screen.
- "ACCESS DENIED" (green, win: the adversary is locked out) and "ACCESS GRANTED" (red, breach) banners with decrypt and chromatic split; boss and elite entrance (rain surge, glitch, shake, decrypting banner).
- Count-ups on reward tally, battle summary, result stats and level number; map node ping rings; achievement ripple plus glyph burst.
- Particles now use the Web Animations API instead of per-particle requestAnimationFrame loops.

**Settings**: new "Digital rain background", "Glitch and chromatic effects", reworded "Animation" and "Rain density". Defaults follow `prefers-reduced-motion`.

**Fixes found in review**: HUD no longer hides Goal and intent below 1150px; mobile hand scrolls horizontally and End turn is always visible; mobile briefing, setup and dossier layouts stack; map node class collision; `--ink3` raised to #7db398 (about 7:1 on the page background); reduced-motion CSS now forces a single iteration; `color-scheme: dark` for native controls; `backdrop-filter` removed everywhere; emoji removed from UI strings; Setup defaults to the Enterprise scenario.

## Bundle and performance

| | before | after |
|---|---|---|
| app JS (min) | 205,458 B (73.8 KB gzip) | 222,613 B (79.5 KB gzip) |
| CSS (min) | 53,953 B | 70,295 B |

Rain cost: one translucent fade rect plus roughly 100-250 glyph draws per second per active column cluster, at 30 fps, one canvas, and it is dimmed to 20% in battle. Concerns: the canvas is full-viewport, so very high-DPI low-end devices should use Low density; the CRT overlay's moving bar is a compositor transform but is a full-screen layer.

## Not done / follow-ups
- The Sigil still uses procedural polygons; per-adversary illustrated portraits would add more character.
- Side panels (programme, relics, SOC feed) remain hidden below 1150px; a drawer would restore them.
- Audio is untouched; keyboard clacks and a glitch sting would complete the theme.
- Map is still three tall columns; a node-and-path graph would read better.
- Card text is still small on 1440x900 hands (inspect via right-click); consider a hover-enlarge that docks above the hand.
