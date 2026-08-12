# V2 Design QA

**Source visual truth**

- Original user reference: `/Users/danielkang11/Downloads/Hvatu_kép.jpg`
- Project copy: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/apps/mobile/assets/cards/source/traditional-hwatu-reference.jpg`
- Source pixels: 250 × 280.
- The supplied image is the visual truth for the 48 traditional card faces. It does not specify the surrounding app UI; the centered stock, irregular field, animation, and capture-spread composition are checked against the user's written V2 requirements.

**Implementation evidence**

- Final landscape screenshot: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/design-qa-final-v2.png`
- Final portrait screenshot: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/design-qa-portrait-v2.png`
- Motion-state screenshot: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/design-qa-final-motion-v2.png`
- Combined comparison: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/design-qa-final-comparison-v2.png`
- All-card contact sheet: `/Users/danielkang11/Documents/ChatGPT/Go Stop Mobile/apps/mobile/assets/cards/contact-sheet-v2.png`

**Viewport and normalization**

- Final landscape: 1280 × 720 CSS pixels and 1280 × 720 screenshot pixels. Browser `devicePixelRatio` was 2; the browser capture API normalized output to CSS pixels.
- Portrait breakpoint: 390 × 844 CSS pixels and screenshot pixels at density 1.
- Compact landscape breakpoint: 844 × 390 CSS pixels and screenshot pixels at density 1.
- Source and implementation are not scaled as if they were the same screen. The combined evidence preserves the full source sheet and full app screen, while the contact sheet and visible in-game faces provide the focused asset comparison.
- State: Round 1, human versus two AI players, opening deal and post-capture states.

**Full-view comparison evidence**

- The traditional vermilion borders, black/ivory fields, month-specific motifs, and compact physical proportions remain visibly consistent with the supplied sheet.
- Month badges remain legible without replacing or obscuring the traditional face art.
- The stock is centered in the playing field, with the six initial face-up cards distributed in a deterministic irregular ring rather than a grid.
- The 1280 × 720, 844 × 390, and 390 × 844 views keep the field, opponent rails, viewer hand, and core controls visible without overlap or clipping.
- Captured cards are visible for all seats, grouped as Gwang, Animal, Tti, and Pi with overlapped physical cards and effective-pi totals.

**Focused region comparison evidence**

- `contact-sheet-v2.png` was visually checked against the source sheet row by row: all 48 month cards are represented once and in the correct January–December order.
- The two generated bonus cards share the traditional red/black/ivory print language, remain distinct from month cards, and are visibly marked `쌍피`; the app adds a Joker badge and exposes the two-pi value in its accessible label.
- The final hand and table screenshots confirm that source imagery remains recognizable at 31 px, 46 px, and 67 px rendered widths.

**Required fidelity surfaces**

- Fonts and typography: the app's existing system-font hierarchy remains consistent, legible, and compact in both orientations. The reference contains no app typography to clone. No actionable mismatch.
- Spacing and layout rhythm: center field dominates the screen, player data stays peripheral, the stock is visually anchored, and capture groups follow a consistent four-category rhythm. No P0/P1/P2 issue.
- Colors and visual tokens: the existing deep-green felt and warm-gold status colors support the reference's vermilion, black, and ivory palette without competing with the card faces. Contrast remains readable. No P0/P1/P2 issue.
- Image quality and asset fidelity: all visible playing-card art is raster imagery from the supplied source or generated bonus/back assets; no code-drawn substitute art remains. Phone-scale sharpness is acceptable. No P0/P1/P2 issue.
- Copy and content: the app and rules page identify the profile as V2 / `mvp-2`; the rules explain that bonus cards are monthless two-pi service cards, not unrestricted wildcards. No P0/P1/P2 issue.
- Icons and affordances: existing help/leave and primary-action affordances remain visible; every playable/zoomable card exposes a labeled semantic button or image role.
- Accessibility and motion: card labels include month, category, double-pi meaning, and Boar Pot significance; captured spreads have group summaries; reduced-motion bypasses decorative animation. No blocking issue found.

**Interaction verification**

- Opened Home → Play vs AI → Start game.
- Played a double-pi bonus card and observed immediate capture, replacement draw, stock decrement, and the card appearing in the Pi spread.
- Waited through both AI turns and confirmed turn ownership returned to the human.
- Played into a two-match month and completed the match-choice dialog.
- Played a normal matching card and exercised the played-card/stock-flip motion queue.
- Confirmed live captured-card spreads update for all three seats.
- Checked final browser console: 0 errors and 0 warnings.

**Comparison history**

- Pass 1 found one P2 copy drift: the home footer still said `MVP rules v1`. It was updated to `MVP rules v2` and verified in the rebuilt browser output.
- Pass 1 also found a non-visual web warning from requesting a native animation driver. The motion layer now uses the native driver only on iOS/Android and the JavaScript driver on web. Post-fix browser logs are clean.
- Post-fix visual evidence is `design-qa-final-v2.png`; the post-fix combined comparison is `design-qa-final-comparison-v2.png`.

**Findings**

- No actionable P0, P1, or P2 findings remain.

**Follow-up polish**

- [P3] The supplied 250 × 280 reference limits the source detail available for very large card previews. A future art-production pass could redraw the same motifs as licensed high-resolution masters while preserving this exact visual language.

**Implementation checklist**

- [x] Traditional 48-face asset set with persistent month badges.
- [x] Two monthless two-pi service cards and a matching card back.
- [x] Centered stock with irregular, bounded table placement.
- [x] Played-card and stock-flip animation, with reduced-motion handling.
- [x] Visible grouped captured-card spreads for all seats.
- [x] Portrait, compact-landscape, and desktop-web checks.
- [x] Post-fix browser interaction and console verification.

final result: passed
