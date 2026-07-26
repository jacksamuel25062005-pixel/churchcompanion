---
name: design
description: Comprehensive design skill for UI/UX work — brand identity, design tokens, UI styling (shadcn/ui + Tailwind), logo generation, corporate identity program (CIP) mockups, HTML presentations, banner design (social/ads/web/print), SVG icon design, and social media photos. Use when the user asks to design a logo, create a CIP, generate mockups, build slides, design a banner, generate icons, or create social/marketing images across Facebook, Instagram, Twitter/X, LinkedIn, YouTube, Pinterest, TikTok, Threads, or Google Ads.
---

# Design

Unified design skill covering brand, tokens, UI, logos, CIP, slides, banners, icons, and social photos.

## When to use

- Brand identity, voice, and asset systems
- Design system tokens, CSS variables, semantic layers
- UI styling with shadcn/ui + Tailwind
- Logo design and AI generation
- Corporate identity program (CIP) deliverables and mockups
- Presentations, pitch decks (HTML + Chart.js)
- Banners for social media, ads, web, print
- Social photos for Instagram, Facebook, LinkedIn, X, Pinterest, TikTok, YouTube
- SVG icon sets

## Sub-skill routing

| Task | Route |
|------|-------|
| Brand identity, voice, assets | Brand direction — palette, type, tone |
| Tokens, specs, CSS vars | Design system — semantic tokens in `src/styles.css` |
| shadcn/ui, Tailwind, code | UI styling — component variants via `cva` |
| Logo creation | Logo section below |
| CIP mockups, deliverables | CIP section below |
| Presentations, pitch decks | Slides section below |
| Banners, covers, headers | Banner section below |
| Social media images | Social photos section below |
| SVG icons | Icon section below |

## Logo design

55+ styles, 30 color palettes, 25 industry guides.

- Prefer the built-in `imagegen--generate_image` tool with `transparent_background: true` and "on a solid white background" in the prompt for logos.
- Choose style from: minimalist, wordmark, monogram, emblem, mascot, geometric, vintage badge, negative-space, abstract mark, lettermark, combination mark.
- Match color to industry (tech: indigo/cyan; healthcare: teal/white; finance: navy/gold; wellness: sage/cream; luxury: black/gold).
- Deliver 3 variants (mark, wordmark, combination) so the user can pick.

## Corporate identity program (CIP)

50+ deliverables across stationery, environmental, digital, packaging.

Deliverable checklist to offer:
- Business card, letterhead, envelope, invoice
- Email signature, presentation template
- Social profile + cover set
- Office signage, reception wall, door plaque
- Merchandise (mug, tote, tee, notebook)
- Vehicle wrap, storefront

Generate mockups with `imagegen--generate_image` (use `standard` or `premium` when brand text must be legible).

## Slides / presentations

HTML pitch decks with design tokens and Chart.js. Structure:
1. Title / brand cover
2. Problem
3. Solution
4. Product demo
5. Market size
6. Traction / metrics (charts)
7. Business model
8. Competition
9. Team
10. Ask / CTA

Copywriting formula: Hook → Insight → Proof → Ask. Keep body ≥ 18px, headline ≥ 40px, max 2 fonts.

## Banner design

| Platform | Type | Size (px) |
|---|---|---|
| Facebook | Cover | 820 × 312 |
| X / Twitter | Header | 1500 × 500 |
| LinkedIn | Personal | 1584 × 396 |
| LinkedIn | Company | 1128 × 191 |
| YouTube | Channel art | 2560 × 1440 (safe 1546 × 423) |
| Instagram | Story | 1080 × 1920 |
| Instagram | Post | 1080 × 1080 |
| Instagram | Portrait | 1080 × 1350 |
| Pinterest | Pin | 1000 × 1500 |
| Google Ads | Medium rectangle | 300 × 250 |
| Google Ads | Leaderboard | 728 × 90 |
| Website | Hero | 1920 × 600–1080 |

Rules: safe zone = central 70–80%, one CTA (bottom-right, ≥ 44px), max 2 fonts, body ≥ 16px, headline ≥ 32px, text under 20% for ads, print 300 DPI CMYK with 3–5mm bleed.

Art direction: minimalist, bold typography, gradient, photo-based, geometric, glassmorphism, neon/cyberpunk, editorial, brutalist, retro, illustrated, isometric.

## Social photos

| Platform | Size |
|---|---|
| IG post | 1080 × 1080 |
| IG story / reel cover | 1080 × 1920 |
| IG carousel | 1080 × 1350 |
| FB post | 1200 × 630 |
| X post | 1200 × 675 |
| LinkedIn post | 1200 × 627 |
| YouTube thumbnail | 1280 × 720 |
| Pinterest pin | 1000 × 1500 |
| TikTok cover | 1080 × 1920 |

Workflow: analyze subject + platform → propose 3–5 concepts → pick → generate at exact dimensions with `imagegen--generate_image` (use `premium` when text must be legible).

## Icon design

15 styles × 12 categories. Deliver SVG.

Top styles:
- **outlined** — UI, web apps
- **filled** — mobile nav bars
- **duotone** — marketing, landing pages
- **rounded** — friendly apps, health
- **sharp** — tech, fintech, enterprise
- **flat** — Material / Google style
- **gradient** — modern SaaS

Rules: 24×24 viewBox, 1.5–2px stroke, consistent optical weight across the set, no emoji as UI icons.

## Design system rules (project-level)

- Never write raw color classes (`text-white`, `bg-black`, `bg-[#...]`). Use semantic tokens from `src/styles.css`.
- Define tokens as `oklch(...)` in `:root`.
- Compose gradients and shadows as tokens (`--gradient-primary`, `--shadow-elegant`).
- Build component variants with `cva` — never hard-code style at call site.
- Every interactive element: `cursor-pointer`, visible focus ring, `transition-colors duration-200`, hover feedback that does not shift layout.
- Touch targets ≥ 44 × 44 px. Body text ≥ 16 px on mobile. Line height 1.5–1.75. Line length 65–75 ch.
- Respect `prefers-reduced-motion`. Animate transform / opacity only, 150–300ms.
- Contrast ≥ 4.5:1 for body text in both themes.

## Pre-delivery checklist

- [ ] No emoji icons — SVG only
- [ ] All icons from one consistent set
- [ ] Hover states do not cause layout shift
- [ ] Semantic tokens only, no hardcoded colors
- [ ] All clickable elements have `cursor-pointer`
- [ ] Focus states visible for keyboard nav
- [ ] Contrast ≥ 4.5:1 in both themes
- [ ] Responsive at 375, 768, 1024, 1440 px
- [ ] No horizontal scroll on mobile
- [ ] Images have alt text; inputs have labels
- [ ] `prefers-reduced-motion` respected
