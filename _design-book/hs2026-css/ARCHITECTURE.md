# HS2026 CSS Architecture — v3 Refactor

## What Changed

The old `style.css` monolith has been split into a proper cascade.  
The design book is now the **single source of truth** for every token.

---

## File Inventory

| File | Role | Load order |
|------|------|-----------|
| `fonts/fonts.css` | Custom typefaces | 1 |
| `css/tokens.css` | All CSS custom properties (`--c-*`, `--space-*`, etc.) | 2 |
| `css/utilities.css` | Semantic utility classes (bg-, color-, .h1–.h4, .wrap, spacing scale) | 3 |
| `css/components.css` | Named components (.btn, .card, .hero-*, .chip, .input, transcript modal) | 4 |
| `css/output.css` | Tailwind compiled output (do not edit directly) | 5 |
| `style.css` | WP theme header + final child overrides (thin!) | 6 |
| `css/blocks.css` | Gutenberg block-specific overrides + all `is-style-*` CSS | 7 (priority 30) |

---

## Deployment Steps

### 1. Copy CSS files
```
css/tokens.css        ← new file (copy from this folder)
css/utilities.css     ← new file (copy from this folder)
css/components.css    ← new file (copy from this folder)
css/blocks.css        ← updated (copy from this folder)
style.css             ← updated (copy from this folder, replaces old one)
```

### 2. Replace theme-setup.php
```
includes/theme-setup.php  ← updated enqueue order (copy from this folder)
```

### 3. Add block-styles.php
```
includes/block-styles.php  ← new file (copy from this folder)
```
Then add this line to `includes/index/load.php` after the theme-setup line:
```php
hs2026_require_module( 'includes/block-styles.php' );
```

### 4. Replace theme.json
```
theme.json  ← updated to version 3, full token mirror (copy from this folder)
```

### 5. Remove from old style.css
Everything except the WP theme header comment block has been moved.  
The new `style.css` is intentionally thin (~50 lines).

---

## What the old style.css had → where it moved

| Old class/rule | Now lives in |
|----------------|-------------|
| `:root { --color-*, --shadow-*, --max-width }` | `css/tokens.css` |
| `.bg-*`, `.color-*`, `.font-quincy` | `css/utilities.css` |
| `.iframing`, `.video-aspect`, `.play-button` | `css/components.css §11` |
| `.card-one`, `.card-two`, `.card-name`, `.card-button` | `css/components.css §12` |
| `.transcript-overlay`, `.transcript-modal` | `css/components.css §13` |
| `.alignfull`, `.col-span-full` | `css/utilities.css §3` + `style.css` |
| `.is-style-big-title` | `css/blocks.css §2` |
| `ul.wp-block-list` | `css/blocks.css §1` + `style.css` |

---

## Token Alignment: tokens.css ↔ theme.json

Every token in `tokens.css` has a mirror in `theme.json`:

| Token | theme.json equivalent |
|-------|-----------------------|
| `--c-gold: #C1A868` | `palette[slug=gold]` |
| `--space-1` through `--space-9` | `spacingSizes[slug=1–9]` |
| `--text-micro` through `--text-display` | `fontSizes[slug=micro–display]` |
| `--container: 1100px` | `layout.wideSize` |
| `--content-zone: 680px` | `layout.contentSize` |
| `--font-display` | `fontFamilies[slug=display]` |
| `--font-body` | `fontFamilies[slug=body]` |

---

## Block Styles Registered (block-styles.php)

### core/heading
- `is-style-big-title` — h1 scale, 700 weight
- `is-style-display` — display scale, 900 weight
- `is-style-label-text` — eyebrow: uppercase label, gold color

### core/button
- `is-style-outline-gold` — transparent + gold border
- `is-style-ghost` — white border, for dark backgrounds
- `is-style-chip` — small pill filter/tag
- `is-style-teal` — green-dark fill
- `is-style-dark` — espresso fill

### core/group
- `is-style-section` — fluid vertical padding
- `is-style-section-inset` — rounded inset section
- `is-style-card` — card shadow + hover lift
- `is-style-card-tight` — card with less padding

### core/columns
- `is-style-hero-cols` — Hero A: 61.8/38.2 golden ratio
- `is-style-hero-float` — Hero B: 55/45 float blob
- `is-style-hero-round` — Hero D: 40/60 circular portrait
- `is-style-golden-grid` — 61.8/38.2 content grid
- `is-style-golden-grid-inv` — 38.2/61.8 inverted

### core/image
- `is-style-round` — circle crop
- `is-style-float-mask` — blob clip-path
- `is-style-card` — rounded + shadow

### core/quote
- `is-style-gold-bar` — left gold border

### core/paragraph
- `is-style-lead` — body-lg size, slightly muted

---

## Next Phase: Patterns

Once this CSS stack is deployed, patterns go in `patterns/*.php`.  
Each pattern will use:
- `.wrap` or `.wp-block-group.is-style-section` for outer shell
- `is-style-*` classes on blocks for layout and visual variants
- Token variables for any inline styles (prefer utility classes)

See `05-block-patterns.html` in the design book for the pattern markup.
