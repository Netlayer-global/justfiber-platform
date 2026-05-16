# JustFiber — Design System (Master)

Single source of truth. All app screens follow this. Inspiration: Coffee Shop UI by Hamad Anwar — disciplined dark, single accent, translucent surfaces, bold typography.

## 1. Core Principles

1. **Discipline over decoration.** One accent color, never multiple. Premium apps (Cred, Linear, Apple Music) follow this.
2. **Translucent over solid.** Cards float on the dark canvas using `white.withOpacity(0.06–0.10)`. No multicolor gradient cards.
3. **Typography carries hierarchy.** Big bold headlines do the visual work — not loud colors.
4. **Accent reserved for action.** Purple is used for primary CTAs, active state, status, and brand moments only — never for filler.
5. **One radius family.** Cards `28`, surfaces `20`, pills `999`, buttons `18`. No random radii.

## 2. Color Tokens

```dart
// Surfaces
const kBg            = Color(0xFF000000);  // pure black canvas
const kSurface       = Color(0x1AFFFFFF);  // 10% white (cards)
const kSurfaceHigh   = Color(0x14FFFFFF);  // 8% white (elevated overlays)
const kSurfaceLow    = Color(0x0AFFFFFF);  // 4% white (input fields)
const kBorderSoft    = Color(0x14FFFFFF);  // 8% white (card borders)
const kBorderHard    = Color(0x33FFFFFF);  // 20% white (focused borders)

// Single accent — purple. NEVER add a second accent.
const kAccent        = Color(0xFF8224E3);  // brand purple
const kAccentDeep    = Color(0xFF5B10A0);  // gradient end (only for hero)
const kAccentSoft    = Color(0x338224E3);  // 20% purple (glow / bg tint)

// Text — pure white at controlled opacities. NO gray hex codes anywhere.
const kText          = Color(0xFFFFFFFF);  // primary
const kTextDim       = Color(0xCCFFFFFF);  // 80%
const kTextMuted     = Color(0x80FFFFFF);  // 50% (labels, captions)
const kTextFaint     = Color(0x4DFFFFFF);  // 30% (placeholders)

// Status — used sparingly, only for true status meaning.
const kSuccess       = Color(0xFF34D399);  // online dot, success
const kDanger        = Color(0xFFEF4444);  // offline dot, errors
```

## 3. Typography

Font family: **Inter** (via `google_fonts`).

| Style       | Size | Weight | Letter spacing | Use                  |
|-------------|------|--------|----------------|----------------------|
| Display     | 32   | 800    | -0.8           | Hero headline line 1 |
| DisplaySpaced | 32 | 800    | +1.5           | Hero headline line 2 (Coffee-Shop style) |
| H1          | 24   | 800    | -0.5           | Screen titles, plan name |
| H2          | 18   | 700    | -0.3           | Section titles |
| Body        | 14   | 500    | 0              | Body text            |
| BodyDim     | 14   | 500    | 0              | white 50% opacity    |
| Eyebrow     | 11   | 800    | +1.6           | UPPERCASE labels (e.g. "DATA USAGE") |
| Caption     | 11   | 500    | 0              | Captions, muted info |

Numbers use **tabular** style where alignment matters (price, data, days).

## 4. Components

### 4.1 Card (default)
```
color:        kSurface (white 10%)
borderRadius: 28
border:       1px kBorderSoft
padding:      20
shadow:       Color(0x33000000), blur 24, offset (0, 8)
```

### 4.2 Pill (status, eyebrow, chips)
```
color:        kSurface OR kAccentSoft when active
borderRadius: 999
padding:      H 12, V 6
border:       1px white(0.18) on glassy variant
```

### 4.3 Primary CTA button
```
background:   kAccent (solid) — NOT a gradient
borderRadius: 18
padding:      H 22, V 16
text:         white, 14, 800
shadow:       kAccent at 45% alpha, blur 18, offset (0, 8) — purple glow
```

### 4.4 Secondary button (Coffee Shop "S/M/L" pattern)
```
selected:    kSurface bg + 1px kAccent border + kAccent text
unselected:  kSurfaceLow bg + 1px transparent + kTextMuted text
borderRadius: 14
padding:      H 18, V 10
```

### 4.5 Floating square icon button (back, fav, more)
```
size:         40 x 40
color:        Colors.black
borderRadius: 12
icon:         kAccent OR kTextDim
```
Used at top corners of full-bleed hero images.

### 4.6 Glassy bottom panel (Coffee-Shop signature)
Used over hero images and on detail screens.
```
color:        Colors.black.withOpacity(0.6)
borderRadius: top 32 / 32 only
padding:      24
```

### 4.7 Quick action item (single accent rule)
```
icon container: 56x56, kSurface bg, 1px kBorderSoft, radius 18
icon color:     kAccent (always — never multi-color)
label:          Body, kText
```

## 5. Layout & Spacing

| Token | Value |
|-------|-------|
| Page padding (horizontal) | 22 |
| Section gap (vertical)    | 28 |
| Card gap (vertical)       | 14 |
| Inner card row gap        | 12 |
| Top safe-area offset      | safeArea.top + 16 |

Bottom nav clearance: list bottom padding `120`.

## 6. Motion

| Element | Duration | Curve |
|---------|---------|-------|
| Page transitions | 320ms | easeOutCubic |
| Stagger entrance | 800ms total | easeOut, intervals (0.0–0.35 / 0.15–0.5 / 0.3–0.65 / 0.45–0.8 / 0.6–1.0) |
| Press scale | 120ms | easeInOut, 0.97 → 1.0 |
| Status pulse | 1500ms | easeInOut (reverse repeat) |

NO infinite background animations (drop the aurora). Static or one-shot only.

## 7. Iconography

- Material rounded set everywhere (`Icons.xxx_rounded`).
- Single accent rule: icons inside accent containers are white; icons on dark surfaces use `kAccent` for active, `kTextMuted` for inactive.
- Stroke weight: default Material rounded.

## 8. Hero Pattern (Coffee Shop signature)

The home plan card uses the full-bleed hero pattern:
1. Image or solid kAccent gradient `(kAccent → kAccentDeep)` fills the card.
2. Top corner: floating square icon buttons (back, more) on Colors.black.
3. Bottom: glassy panel (Section 4.6) showing plan name, sub-info, and a small accent-icon row.
4. Status pill on top-left: pulsing dot + "Connected".

## 9. Anti-patterns (do not do)

- ❌ Multiple gradient colors on the same screen (cyan, blue, green, amber together)
- ❌ Solid colored cards in red/orange/green for emphasis (translucent surface + accent text only)
- ❌ Different gray hex codes (`#8B93A5`, `#B8C0CC`, `#6B7280`) — use `kTextMuted` / `kTextFaint` only
- ❌ Random border radii — stick to the radius family
- ❌ Loud secondary backgrounds (purple bill due strip, orange ticket card) — use `kSurface` + accent text
- ❌ Backdrop animations (aurora blobs) — they fight content
- ❌ Emoji icons — Material rounded only
- ❌ Letter-spacing on body text — only on display line 2 and eyebrows

## 10. Component Inventory (to refactor)

| Screen                        | Status |
|-------------------------------|--------|
| home_tab.dart                 | rebuilding now |
| billing_history_screen.dart   | next |
| service_hub_screen.dart       | next |
| support_screen.dart           | next |
| profile_tab.dart              | next |
| plan_catalog_screen.dart      | next |
| public_plan_catalog_screen.dart | next |
| booking_payment_screen.dart   | next |
| booking_enquiry_screen.dart   | next |
| login_screen.dart             | review |
| splash_screen.dart            | keep (already premium) |

## 11. Locked decisions

- One accent: `#8224E3`. No second accent.
- Background: pure black `#000000`. No purple-tinted black.
- All surfaces: translucent white. No solid card colors.
- Bottom nav: dark surface + accent indicator (already done).
- Bell icon on top bar: removed (already done).
- Hero CTA: "Upgrade Plan" only (already done).
