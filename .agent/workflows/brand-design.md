---
description: HSos Brand Design System — apply to all web pages and apps
---

# HSos Brand Design System

All web pages and apps built in this project MUST follow the HSos design system and the design book located at `_design-book/`.

This file is the execution layer for Claude Code and any agent workflow.
Use it when updating existing screens, creating new pages, or refactoring UI.
It applies to the current HTML app as well as future modules.

## Quick Reference

### Fonts
- **Display / Headings**: `'Quincy', Georgia, 'Times New Roman', serif` (var `--font-display`)
  - Black (900) for hero/display  
  - Bold (700) for section headings (h2–h4)
- **Body / UI**: `'Effra', 'Helvetica Neue', Arial, sans-serif` (var `--font-body`)
  - Regular (400) for prose  
  - Bold (700) for labels, micro, buttons

> **Fallback note**: If Quincy/Effra are not available as hosted font files, use Google Fonts equivalents:
> - Quincy → **Playfair Display**
> - Effra → **DM Sans**
> Keep the brand fonts first in the stack so they work if/when available.
> For the current internal app, DM Sans is the preferred fallback body/UI font.

### Color Palette (use these exact hex values)
| Token              | Hex       | Usage                         |
|--------------------|-----------|-------------------------------|
| `--c-gold`         | `#C1A868` | Primary brand gold            |
| `--c-gold-deep`    | `#A8904F` | Gold hover states             |
| `--c-green-dark`   | `#026360` | Deep brand green              |
| `--c-deep-teal`    | `#1E5E5B` | Teal hover / variants         |
| `--c-teal`         | `#409690` | Medium teal                   |
| `--c-soft-blue`    | `#CBE3E5` | Light blue-teal decorative    |
| `--c-light-blue`   | `#F3F7FA` | Near-white blue section bg    |
| `--c-light-purple` | `#F7F2F9` | Near-white purple section bg  |
| `--c-pink`         | `#F9F2F3` | Near-white pink section bg    |
| `--c-warm-cream`   | `#FAF5EC` | Warm cream section bg         |
| `--c-peach`        | `#F7BAA4` | Pastel peach accent           |
| `--c-white`        | `#FFFFFF` | Pure white                    |
| `--c-espresso`     | `#1A1410` | Primary dark / body text      |
| `--c-amber`        | `#6B4F2A` | Amber brown                   |
| `--c-berry`        | `#8B3A52` | Deep berry / raspberry        |
| `--c-terracotta`   | `#C4622D` | Warm terracotta orange        |
| `--c-slate`        | `#4A6E7A` | Cool slate blue               |

### Type Scale (fluid clamp, 400px → 1400px)
| Class     | Size                | Weight | Leading | Tracking  |
|-----------|---------------------|--------|---------|-----------|
| `.display`| 56→112px            | 900    | 1.05    | -0.04em   |
| `.h1`     | 46→76px             | 900    | 1.2     | -0.02em   |
| `.h2`     | 36→52px             | 700    | 1.2     | -0.02em   |
| `.h3`     | 28→38px             | 700    | 1.4     | normal    |
| `.h4`     | 22→28px             | 700    | 1.4     | normal    |
| `.body-lg`| 18→22px             | 400    | 1.618   | normal    |
| `.body`   | 16→18px             | 400    | 1.618   | normal    |
| `.label`  | 12→14px uppercase   | 700    | 1       | +0.08em   |
| `.micro`  | 10→12px uppercase   | 700    | 1       | +0.14em   |

### Spacing Scale (φ progression from 4px)
| Token       | Value    | Use                              |
|-------------|----------|----------------------------------|
| `--space-1` | 4px      | Icon gap, micro spacing          |
| `--space-2` | 6px      | Tight inline elements            |
| `--space-3` | 10px     | Close siblings, badge padding    |
| `--space-4` | 16px     | **= 1rem = body base anchor**    |
| `--space-5` | 26px     | Card inner rhythm, input padding |
| `--space-6` | 42px     | Card padding, between-element    |
| `--space-7` | 68px     | Narrow section padding           |
| `--space-8` | 110px    | Standard section vertical rhythm |
| `--space-9` | 178px    | Max hero breathing room          |

### Shadows (always use warm espresso tint #1A1410, not black)
| Level    | CSS                                                                  |
|----------|----------------------------------------------------------------------|
| Subtle   | `0 1px 3px rgba(26,20,16,.05), 0 4px 12px rgba(26,20,16,.05)`       |
| Card     | `0 2px 6px rgba(26,20,16,.06), 0 8px 24px rgba(26,20,16,.08)`       |
| Raised   | `0 4px 12px rgba(26,20,16,.08), 0 16px 48px rgba(26,20,16,.10)`     |
| Float    | `0 8px 24px rgba(26,20,16,.10), 0 32px 80px rgba(26,20,16,.12)`     |
| Gold CTA | `0 4px 20px rgba(193,168,104,.25)`                                   |

### Border Radius
| Token               | Value   | Use                     |
|---------------------|---------|-------------------------|
| `--radius-sm`       | 6px     | Input, badge            |
| `--radius-card`     | 12px    | Card                    |
| `--radius-section`  | 20px    | Inset rounded section   |
| `--radius-section-lg`| 40px   | Large rounded section   |
| `--radius-pill`     | 9999px  | Pill / circle           |

### Layout Dimensions
- **Container**: max-width 1100px
- **Content zone**: 680px (1100 / φ — golden reading width)
- **Sidebar**: 420px (1100 / φ²)
- **Two-column splits**: always 61.8% / 38.2% or 50/50

### Breakpoints (mobile-first)
- xs: ≤479px (mobile portrait)
- sm: ≤767px (mobile landscape / tablet stack)
- md: ≤1023px (tablet)
- lg: ≥1280px (wide desktop)

### Constitutional Rules
1. All spacing from the scale — no arbitrary px values
2. Body text = Effra only, Headings = Quincy only — never mix roles
3. Line length: 52–72 chars for body text
4. Sections alternate light/dark backgrounds
5. Container max-width: 1100px — never increase
6. Card padding: space-6 standard (space-5 min, space-7 max)
7. Section vertical padding: space-8 (non-negotiable)
8. Two-column splits: 61.8/38.2 or 50/50 only
9. Dark backgrounds auto-inherit `rgba(255,255,255,0.85)` text
10. Shadows always use warm espresso tint, not pure black

### Button Styles
- **Primary** (`.btn-primary`): Gold fill, white text, gold glow shadow
- **Outline** (`.btn-outline`): Espresso border, fills on hover
- **Dark** (`.btn-dark`): Espresso fill, amber on hover
- **Teal** (`.btn-teal`): Green-dark fill
- **Gold Outline** (`.btn-gold-outline`): Gold border, fills gold on hover
- **Ghost** (`.btn-ghost`): White border for dark backgrounds
- All buttons: pill radius, uppercase, Effra Bold, tracking-wide

### How to Apply
1. Import `tokens.css` in any new CSS file
2. Use the token CSS variables (e.g., `var(--c-gold)`, `var(--space-5)`)
3. Use utility classes when available (`.bg-gold`, `.h2`, `.btn-primary`, etc.)
4. Reference `_design-book/style-guide.css` for the full class inventory

---

## App-Specific UI Guidance

Use the brand system on internal app screens too, not only marketing pages.

### App interpretation rules
1. Keep the structural app UI clean and functional first
2. Use brand color intentionally, not everywhere at once
3. Prefer light backgrounds with strong typography and restrained accents
4. Reserve gold for primary actions, highlights, and active emphasis
5. Use green-dark / teal for secondary actions, status accents, and navigation emphasis
6. Use warm neutral surfaces for cards, panels, and section separation
7. Do not turn operational screens into decorative landing pages

### Recommended mapping for the current app
- top bar / navigation: deep green or white with strong contrast
- page background: light blue, warm cream, or white
- cards and side panels: white with warm shadow
- primary CTA: gold
- secondary CTA: deep green / teal
- destructive actions: use restrained contrast, do not invent bright red unless defined later
- headings: display font where appropriate, but keep dense data views primarily in body/UI font

### Data-heavy screen rule
For dashboards, tables, kanban boards, lists, filters, and forms:
- readability wins over decoration
- use body/UI font for dense controls
- use display font sparingly for page titles, section titles, and major headers only
- keep spacing generous and consistent with the token scale

### Implementation note for existing pages
When updating existing HTML screens:
- align them to this brand system gradually
- do not break existing layout logic just to force visual styling
- first apply tokens, typography, buttons, panels, and spacing
- then refine cards, filters, badges, tables, and modals
