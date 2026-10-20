---
name: Omnysync
description: Multi-platform content synchronization platform with a clean, confident product UI.
colors:
  primary: "#0064e0"
  primary-hover: "#0457cb"
  primary-soft: "#0091ff"
  on-primary: "#ffffff"
  background: "#ffffff"
  foreground: "#16181d"
  card: "#ffffff"
  card-foreground: "#16181d"
  surface-soft: "#f5f6f8"
  muted: "#f5f6f8"
  muted-foreground: "#5c6a79"
  accent: "#f1f4f8"
  accent-foreground: "#16181d"
  destructive: "#e02d47"
  destructive-foreground: "#ffffff"
  destructive-soft: "#fef1f3"
  border: "#e6e9ee"
  border-strong: "#d3d9e1"
  input: "#98a2b0"
  ring: "#0064e0"
  success: "#157f43"
  success-soft: "#ecfdf3"
  warning: "#a15c07"
  warning-soft: "#fffaeb"
  info: "#0064e0"
  info-soft: "#eef5ff"
  chart-1: "#0064e0"
  chart-2: "#16a3d9"
  chart-3: "#16a34a"
  chart-4: "#f59e0b"
  chart-5: "#7c3aed"
  sidebar-bg: "#0b1118"
  sidebar-foreground: "#e8eef6"
  sidebar-primary: "#4da3ff"
  sidebar-primary-foreground: "#ffffff"
  sidebar-accent: "#151e28"
  sidebar-border: "#1f2a36"
  dark-background: "#0a0f14"
  dark-foreground: "#f2f4f7"
  dark-card: "#10161d"
  dark-popover: "#121920"
  dark-surface-soft: "#182029"
  dark-muted: "#182029"
  dark-muted-foreground: "#9aa6b4"
  dark-accent: "#1d2630"
  dark-accent-foreground: "#f2f4f7"
  dark-border: "#1f2933"
  dark-border-strong: "#2b3742"
  dark-input: "#39434f"
  dark-ring: "#4da3ff"
  dark-primary: "#0091ff"
  dark-primary-hover: "#33a6ff"
  dark-sidebar-bg: "#070c11"
  dark-sidebar-foreground: "#e8eef6"
  dark-sidebar-border: "#1a2530"
  error: "#e02d47"
typography:
  display:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
  heading-1:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
  heading-2:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.25
  heading-3:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
  heading-4:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
  label:
    fontFamily: Schibsted Grotesk, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
  code:
    fontFamily: IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: 2px
  sm: 3px
  md: 3px
  lg: 3px
  xl: 3px
  xxl: 3px
  full: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section: 64px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 8px 14px
    border: 1px solid '{colors.border}'
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 8px 14px
  button-destructive:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 8px 14px
  button-marketing-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 12px 32px
  button-marketing-secondary:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 12px 32px
    border: 1px solid '{colors.border}'
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
    border: 1px solid '{colors.border}'
    shadow: 0 1px 2px rgb(16 24 40 / 0.05), 0 1px 3px rgb(16 24 40 / 0.06)
  card-hover:
    shadow: 0 2px 4px -1px rgb(16 24 40 / 0.05), 0 6px 14px -2px rgb(16 24 40 / 0.08)
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
    height: 36px
    border: 1px solid '{colors.input}'
  input-focused:
    border: 1px solid '{colors.ring}'
    ring: 0 0 0 2px rgba(0, 100, 224, 0.25)
  input-error:
    border: 1px solid '{colors.destructive}'
  badge:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
  badge-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
  badge-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
  badge-outline:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    border: 1px solid '{colors.border}'
  nav-sidebar:
    backgroundColor: "{colors.sidebar-bg}"
    textColor: "{colors.sidebar-foreground}"
    width: 256px
    border: 1px solid '{colors.sidebar-border}'
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: 24px
    shadow: 0 4px 8px -2px rgb(16 24 40 / 0.06), 0 20px 40px -6px rgb(16 24 40 / 0.14)
  separator:
    backgroundColor: "{colors.border}"
    height: 1px
  tab-trigger:
    backgroundColor: transparent
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 4px 12px
  tab-trigger-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    shadow: 0 1px 2px rgb(16 24 40 / 0.05)
  skeleton:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.md}"
  progress:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.xs}"
    height: 8px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.xs}"
  select-trigger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
    height: 36px
    border: 1px solid '{colors.input}'
  switch:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.full}"
    height: 24px
    width: 44px
  switch-checked:
    backgroundColor: "{colors.primary}"
  avatar:
    rounded: "{rounded.lg}"
    size: 40px
  alert-dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: 24px
---

# Design System: Omnysync

## 1. Overview

**Creative North Star: "Signal / Routing"**

Omnysync is the routing layer between a draft and every place it needs to live. The interface should feel like an operations instrument: one source, visible paths, and a clear record of what reached where. Marketing pages borrow the language of the product — source and destination nodes, run manifests, capability ledgers, spec-sheet pricing — instead of generic SaaS card grids.

The aesthetic is editorial but technical: asymmetric layouts, ink panels, thin rules, mono metadata, and a single cobalt signal. White space is structural, not decorative. The interface should make the route legible before it tries to be beautiful.

This system explicitly rejects: centered hero-plus-three-cards templates, repeated feature tiles, decorative gradients and glassmorphism, oversized rounded surfaces, faux testimonials, and invented customer logos.

**Key Characteristics:**

- Cobalt blue (`#0064e0`) as the single accent color, used as a signal for primary actions, active routes and live state only
- White canvas (`#ffffff`) as the default background, with ink panels (`#0b1118`) for route consoles, the app sidebar and the flow band
- Schibsted Grotesk for display/UI, IBM Plex Mono for technical metadata - one display family plus a utility mono, no third face
- Sharp geometry: max 3px radius on every surface, no pill-shaped buttons or badges; circles are reserved for functional status dots, switches, radios and spinners
- Table-first and ledger-first composition: connector rails, run manifests, capability rows and pricing matrices before card grids
- Flat-by-default elevation with tonal layering; shadows only for interactive feedback and floating surfaces
- Dark mode as a control room with full token parity
- Strong state coverage: loading, empty, error, and success states on every major surface

## 2. Colors

The palette follows a Restrained strategy: white canvas + single cobalt accent + neutral grays for hierarchy.

### Primary

- **Cobalt Blue** (`#0064e0`): The sole accent color. Used for primary CTAs, active navigation indicators, link text, focus rings, and the active tab state. Never used decoratively.
- **Cobalt Hover** (`#0457cb`): Pressed state for primary buttons and interactive elements.
- **Cobalt Soft** (`#0091ff`): Dark-mode primary variant. Brighter to maintain contrast against dark backgrounds.

### Semantic

- **Success Green** (`#157f43`): Sync-completed indicators, "in stock" badges, positive confirmation toasts. Paired with `#ecfdf3` soft surface. Text-safe on white (4.6:1).
- **Warning Amber** (`#a15c07`): Medium-priority alerts, near-limit usage warnings. Paired with `#fffaeb` soft surface.
- **Info Blue** (`#0064e0`): Neutral informational states, "in progress" indicators. Paired with `#eef5ff` soft surface.
- **Error Red** (`#e02d47`): Destructive actions, sync failure indicators, validation errors.

### Neutral

- **White** (`#ffffff`): Page canvas and primary card surface.
- **Soft Gray** (`#f5f6f8`): Muted surface, accent container, thumbnails, and quiet section bands.
- **Ink** (`#16181d`): Primary text color for headings and body copy.
- **Muted Text** (`#5c6a79`): Secondary text for descriptions, metadata, and supporting copy.
- **Border** (`#e6e9ee`): Card borders, dividers, and separators — intentionally quiet.
- **Border Strong** (`#d3d9e1`): Structural borders that need more definition than the default.
- **Input Border** (`#98a2b0`): Form-control strokes. Darker than the default border so fields stay identifiable (≈2.9:1 against white).

### Dark Mode

- **Deep Ink** (`#0a0f14`): Dark canvas and page background.
- **Dark Card** (`#10161d`): Card and elevated surface backgrounds.
- **Dark Popover** (`#121920`): Menus, selects, and dialogs above cards.
- **Ink Sidebar** (`#070c11` in dark, `#0b1118` in light): Navigation rail, route consoles and the flow band. This is an ink surface in both themes, not a neutral inversion.
- **Dark Muted Text** (`#9aa6b4`): Secondary text on dark surfaces.
- **Dark Border** (`#1f2933`): Card borders and dividers on dark backgrounds.
- **Dark Input** (`#39434f`): Form-control strokes on dark backgrounds.

### Named Rules

**The One Accent Rule.** Cobalt blue is the only accent color. It appears on primary buttons, focus rings, active states, and links — covering ≤10% of any given screen. Its rarity is the point. If a new accent color is needed, it must earn its place through a specific semantic role (success/warning/error), not decoration.

**The Dark Mode Parity Rule.** Every light-mode token has a corresponding dark-mode token. Dark mode is not an afterthought — it's compiled from the same component system with inverted neutrals and a brighter primary variant for contrast.

## 3. Typography

**Display & Body Font:** Schibsted Grotesk (with system-ui, -apple-system, sans-serif fallback). Loaded as a variable font from Google Fonts via `next/font/google` with `display: swap`, exposed as `--font-ui` and consumed by the `--font-sans` token.

**Code/Mono Font:** IBM Plex Mono (with `ui-monospace`, `SFMono-Regular`, Menlo fallback). Loaded via `next/font/google` as `--font-mono-ui` and consumed by the `--font-mono` token. Used for run IDs, timestamps, status labels, section indices, table metadata and log consoles.

**Character:** Schibsted Grotesk is a contemporary grotesque with a tall x-height and slightly compressed letterforms - precise and technical without feeling anonymous. It carries the full hierarchy from 48px display headlines to 12px caption text. IBM Plex Mono handles run IDs, timestamps and technical metadata, so the interface feels like an instrument rather than a generic SaaS template.

### Hierarchy

| Token      | Size    | Weight | Line Height | Use                                           |
| ---------- | ------- | ------ | ----------- | --------------------------------------------- |
| Display    | 48–84px | 600    | 0.96        | Landing hero and closing statement (clamp)    |
| Heading 1  | 36px    | 700    | 1.2         | Page titles, section headers                  |
| Heading 2  | 30px    | 700    | 1.25        | Dashboard page titles, modal headers          |
| Heading 3  | 24px    | 600    | 1.3         | Card titles, subsection headers               |
| Heading 4  | 20px    | 600    | 1.35        | Feature tile titles, form section labels      |
| Body       | 16px    | 400    | 1.5         | Primary reading text, 65–75ch max line length |
| Body Small | 14px    | 400    | 1.43        | Secondary text, descriptions, metadata        |
| Caption    | 12px    | 400    | 1.33        | Timestamps, badge labels, footer fine print   |
| Label      | 14px    | 500    | 1.43        | Button labels, form labels, tab text          |
| Code       | 14px    | 400    | 1.5         | Log consoles, error messages, code displays   |

### Named Rules

**The Two-Family Rule.** Schibsted Grotesk carries every display and UI role; IBM Plex Mono is a utility face for technical metadata only. No editorial serif, no third family, no display/body pairing inside the UI.

**The Fixed Scale Rule.** Product UI uses fixed px/rem sizes, not fluid clamp(). Marketing display type may use clamp() for the hero and closing statement; every other marketing label stays on the fixed scale.

## 4. Elevation

The system is predominantly flat. Depth is conveyed through tonal layering (light gray surfaces on white canvas) rather than shadows. Shadows are used sparingly and only as interactive feedback, not as a decorative layer.

### Shadow Vocabulary

The scale is two-layer (a tight contact shadow + a wide diffuse shadow) so surfaces read as grounded rather than fuzzy. Dark mode swaps to deeper black alphas at the same geometry.

- **`--shadow-2xs`** (`0 1px 2px rgb(16 24 40 / 0.04)`): Inputs, selects, outline buttons — barely-there grounding.
- **`--shadow-xs`** (`0 1px 2px / 0.05`): Primary buttons, active tab.
- **`--shadow-sm`** (`0 1px 2px / 0.05, 0 1px 3px / 0.06`): Cards at rest.
- **`--shadow-md`** (`0 2px 4px -1px / 0.05, 0 6px 14px -2px / 0.08`): Hovered selectable cards, sticky rails.
- **`--shadow-lg`** (`0 2px 6px -1px / 0.05, 0 12px 24px -4px / 0.1`): Menus, selects, popovers.
- **`--shadow-xl`** (`0 4px 8px -2px / 0.06, 0 20px 40px -6px / 0.14`): Dialogs and alert dialogs.
- **Modal backdrop:** `rgb(0 0 0 / 0.45)` scrim with a 2px blur, deepening to `0.6` in dark mode.

### Named Rules

**The Grounded Rule.** Every floating surface gets exactly one shadow from the scale. Never stack a card shadow inside a dialog shadow, and never add a hover shadow to something that is already floating.

**The Tonal Layer Rule.** When hierarchy is needed between flat surfaces, use background color contrast (white canvas → soft gray bands → ink consoles/sidebar) rather than shadows. The sidebar, route consoles, cards, and content area are distinguished by surface color, not z-index.

## 5. Components

### Buttons

- **Shape:** 3px rounded corners for dashboard buttons and marketing CTAs. No pill-shaped buttons.
- **Sizes:** 36px default height, 32px small, 40px large, 36px square icon buttons
- **Primary:** Cobalt blue (`#0064e0`) background, white text, `shadow-xs`. Used for primary actions: "Create", "Save", "Sync", "Connect"
- **Hover:** Deepens to `#0457cb` (never fades to transparency)
- **Disabled:** Opacity 50%
- **Secondary:** Muted gray fill (`#f5f6f8`), ink text. Used for secondary actions
- **Outline:** Transparent background, ink text, `1px solid {colors.border}`, `shadow-2xs`
- **Ghost:** Transparent, no border. Used for inline toolbar actions and less prominent controls
- **Destructive:** Soft red (`#fef1f3`) background with red (`#e02d47`) text. Destructive confirms that need full weight use a solid red button inside the confirmation dialog
- **Loading:** All button variants show a spinner replacing the icon slot during async operations

### Cards

- **Shape:** 3px rounded corners, `1px solid {colors.border}` stroke, `shadow-sm`
- **Background:** White (`#ffffff`), or dark card (`#10161d`) in dark mode
- **Padding:** 24px standard (`p-6`), 16px compact variant for dense lists
- **Title:** 16px semibold with tight tracking. Marketing pages may override to 24px
- **Internal spacing:** 16px between child elements
- **Nested cards are prohibited.** If a card needs internal grouping, use a border separator or background tint instead

### Inputs & Form Controls

- **Shape:** 3px rounded corners, `1px solid {colors.input}` stroke, `shadow-2xs`
- **Height:** 36px standard. Auth and marketing forms may use 40–44px for touch comfort
- **Background:** White (light) or the card surface (dark)
- **Focus:** Stroke switches to `{colors.ring}` plus a `2px` 25%-alpha cobalt halo. Keyboard-only (`:focus-visible`)
- **Error:** Stroke switches to `1px solid {colors.destructive}`; inline error message below in red body-sm
- **Disabled:** Opacity 50% with `cursor-not-allowed`
- **Select:** Same shape as inputs, with a muted chevron icon on the right
- **Textarea:** Same styling as inputs, minimum 80px height, resizable vertically
- **Placeholder:** Uses `muted-foreground` — never a lighter gray, so it keeps 4.5:1 contrast

### Navigation

- **Desktop Sidebar:** 256px wide (`w-64`), ink surface (`#0b1118` light, `#070c11` dark) with a matching `sidebar-border`, `sidebar-foreground` text, and a 2px cobalt signal bar on the active item. Icon + text labels in 36px (`h-9`) rows. Navigation is grouped into an unlabeled primary group, "Workspace", and "Account"; group headings are 9px mono, uppercase, 35% opacity. Footer holds the command-palette trigger, docs link, and a user card with icon-only logout
- **Active state:** White 6% background + `sidebar-foreground` text + medium weight + left cobalt bar. `/dashboard` and `/admin` only match exactly (nested routes must not light up the root entry) — see `isNavItemActive()` in `src/lib/nav.ts`
- **Mobile Drawer:** Full-height slide-in from left, 288px wide (`w-72`). Ink surface and the same sidebar tokens as desktop. Overlay backdrop at 50% opacity with a 2px blur. Close button top-right. Same grouped nav as desktop; user + logout pinned at the bottom
- **Dashboard Top Bar:** Fixed 56px (`h-14`) bar with breadcrumbs (path segments mapped to translated labels, unknown IDs rendered as-is), a search/⌘K trigger, theme toggle, and avatar. It replaces the marketing header on all `/dashboard`, `/admin`, and `/auth` routes
- **Top Bar (public pages):** Fixed header with logo left, nav links center (hidden on mobile), CTA buttons right. Background at 85% opacity with `backdrop-blur`
- **Tab Navigation:** Segmented tabs with 3px corners. Active tab: `background` surface, `shadow-xs`, foreground text

### Badges & Status Indicators

- **Shape:** 3px corners, 2px 8px padding, 12px medium weight. Metadata reads as a technical tag, not a pill
- **Default:** Cobalt background, white text. Used for active status ("Active", "Pro")
- **Secondary:** Muted gray background, ink text. Used for neutral status ("Member", "Inactive")
- **Success / Warning / Info:** Soft semantic surface + matching text color (`#ecfdf3`/`#157f43`, `#fffaeb`/`#a15c07`, `#eef5ff`/`#0064e0`). Preferred over solid fills — quieter, and text contrast stays above 4.5:1
- **Destructive:** Solid red background, white text. Used for error states ("Failed", "Error")
- **Outline:** Transparent with border. Used for secondary status labels
- **Semantic dot indicators:** Colored dots (success/warning/info) next to sync log entries for quick status scanning

### Progress & Loading

- **Progress Bar:** 8px height, 2px corners. Muted gray track, cobalt fill, 300ms transform transition. Used on sync progress and usage limit displays
- **Loading Spinner:** 32px animated spinner for page-level loading. 16px for inline button loading. Spinners are the only circular loading shape
- **Skeleton:** Soft gray rectangles with 3px corners matching the shape of the content being loaded. Used on dashboard cards before data arrives
- **Empty State:** Left-aligned or centered layout with icon + heading + description + optional action button. Used on all list pages when no data exists

### Dialogs & Modals

- **Shape:** 3px corners, 24px padding, `shadow-xl`
- **Backdrop:** `rgb(0 0 0 / 0.45)` overlay with a 2px blur (`0.6` in dark mode)
- **Width:** `max-w-md` (448px) standard, `max-w-lg` (512px) for forms
- **Header:** Title + description + optional close X button (28px hit area, top-right)
- **Footer:** Action buttons right-aligned (primary + cancel), stacked reverse on mobile
- **Dismiss:** Escape key, click-outside, and explicit cancel/close affordance

### Marketing Surfaces

- **Hero:** asymmetric two-column composition. Left: mono route index, display headline, single primary CTA. Right: `RouteMap` in an ink console with registration marks; a thin blueprint grid is clipped to the hero and never used as a page background.
- **Connector rail:** a horizontal, scrollable ledger of supported sources and destinations, each labelled `SOURCE` or `DESTINATION` in mono. Replaces logo strips and trust-bar clichés.
- **Run record / demo:** a split panel. Left: the real product recording with a REC chrome and square play control. Right: `RunManifest`, an ink ledger of source → parse → enrich → publish → destinations, with latency and error metadata.
- **Capability ledger:** a sticky editorial heading beside full-width rows. Each row carries a mono index, icon, title, description and one small product diagram (two-way route, sync bars, schedule timeline). No repeated card grid.
- **Flow band:** full-bleed ink section with a blueprint wash, three numbered steps, mono source/document/destination metadata and no card containers.
- **Closing CTA:** oversized two-line statement (`Draft once.` / `Publish everywhere.`) with the action rail aligned to the baseline on the right. No centered card or ambient glow.
- **Pricing matrix:** one spec-sheet table. The Pro column is the signal column: ink surface, cobalt top rule, included badge and primary CTA. The capability column is sticky on horizontal scroll. Rows use explicit limits instead of decorative checkmarks.
- **Footer:** four-column index (brand, product, account, system) with mono column labels and a legal rail. No newsletter form or invented social proof.

### App Surfaces

- **Shell:** ink sidebar (`{colors.sidebar}`), mono breadcrumb rail, solid top bar. Navigation is a list of routes, not a stack of cards. Active state is a cobalt left indicator plus a quiet surface shift.
- **Page header:** mono eyebrow (`SURFACE / NN`), display title, one-line description, action rail, closed by a full-width border. Pages without an eyebrow still share the same rhythm.
- **Dashboard:** the operations console. A status line (`LIVE · ALL SYSTEMS NOMINAL`), a sync-rate panel on an ink blueprint grid, three metric rows in a shared ledger, a run-log table and a route-setup column. No four-card KPI grid.
- **Sync rate:** one dominant percentage with a thin cobalt progress rule and mono bounds. Metadata sits in the panel, not in a floating badge.
- **Run log:** timestamped rows with a square status marker, event message, document ID and right-aligned time. Header labels are mono and uppercase.
- **Document register:** full-width table with mono column labels, machine IDs under titles, source → destination in the pipeline column and square status markers. A footer rail carries the row count.
- **Empty states:** left-aligned, one route diagram and one primary next action. Never a centered illustration card.
- **Onboarding:** numbered route steps in a border-led list with completion markers. Progress is expressed as `n/3`, not a decorative ring.

## 6. Motion

Motion is functional first: it confirms state, directs attention, and covers transitions. Product surfaces stay in the 150–250 ms band; marketing surfaces get one rehearsed entrance per page instead of scroll-triggered reveals on every section.

### Tokens

- **Easings:** `--ease-out-quart` (state changes) and `--ease-out-expo` (entrances). No bounce, no elastic.
- **Entrance utilities:** `animate-enter-up` (0.6s), `animate-enter-fade` (0.5s), `animate-enter-scale` (0.7s, for mockups), `animate-slide-in-right` (0.7s, auth panel), `animate-shake` (0.4s, validation errors), `animate-pulse-soft` (2.4s, live indicators), `animate-drift` (20s, ambient glows).
- All entrance animations use `fill-mode: both`, so the final state is the visible default. Stagger is applied with an inline `animationDelay`.

### Rules

**The One Entrance Rule.** Each marketing/auth page choreographs one load sequence (hero or form + panel) in reading order; sections encountered while scrolling are static. This keeps pages fast and avoids fade-on-scroll fatigue.

**The Feedback Rule.** Interactive elements use transitions for hover/active feedback (`translate-y-px` on press, shadow lift on cards, border shift on hover) and the 150–250 ms band. Motion never blocks interaction.

**The Reduced Motion Rule.** The global `prefers-reduced-motion: reduce` block collapses every animation and transition to ~0 ms and clears delays, so content renders in its final state. Scroll-driven enhancements (`header-elevate`) are excluded from reduced motion entirely, and `scroll-behavior: smooth` only applies under `no-preference`.

**The Progressive Enhancement Rule.** The header elevation runs on a CSS scroll timeline inside `@supports`; unsupported browsers keep the static header. No content is gated behind JavaScript-triggered reveals.

## 7. Do's and Don'ts

### Do:

- **Do** use cobalt blue (`#0064e0`) for primary actions only — its visual weight is meaningful because it's rare
- **Do** use 3px rectangular badges for status labels and tags — the sharp shape signals "metadata, not action"
- **Do** use the sidebar icon + text pattern consistently — every nav item has both an icon and a text label
- **Do** provide loading, empty, error, and success states for every major data-fetching surface
- **Do** use progressive disclosure for complex workflows — the 5-step sync wizard is the model pattern
- **Do** maintain dark mode token parity — every surface should work in both modes without layout changes
- **Do** keep every surface at 3px radius or less — buttons, inputs, cards, badges, dialogs, avatars. Only status dots, switches, radios and spinners are circular
- **Do** use Schibsted Grotesk for display/UI and IBM Plex Mono for technical metadata — two families, each with a clear job
- **Do** compose marketing with asymmetric grids, ledger rows and ink consoles; let tables and mono metadata carry the product story
- **Do** make the recommended plan the signal column in pricing, with explicit limits rather than decorative checkmarks
- **Do** keep destructive actions behind confirmation dialogs — delete, remove, and revoke always require a second click

### Don't:

- **Don't** introduce additional accent colors beyond cobalt blue — the restrained palette is intentional
- **Don't** use decorative embellishments (gradient text, glassmorphism, heavy shadows, animated backgrounds) — this is a tool, not a showcase
- **Don't** mix button shapes on the same surface — dashboard buttons and marketing CTAs both use 3px corners. Never use pills
- **Don't** nest cards — use borders, background tints, or inline separators instead
- **Don't** use modals as a first default — exhaust inline expansions, side panels, and progressive disclosure first
- **Don't** ship with missing states — every list page needs loading, empty, error, and populated states
- **Don't** hardcode French labels in English UI (or vice versa) — use the i18n translation system for all user-facing text
- **Don't** add keyboard shortcuts without documenting them — power features should be discoverable
- **Don't** use numbered markers as generic decoration — numbers must index a real route, sequence or ledger row, never arbitrary feature cards
- **Don't** use side-stripe borders (border-left/right >1px as colored accents) — use full borders, background tints, or nothing
- **Don't** repeat the same card three times and call it a features section; use a ledger, a matrix or one dominant surface
- **Don't** center every marketing section — centered layouts flatten the route and read as a template
- **Don't** use animated page-load sequences — product users are in flow and shouldn't wait for choreography

## 8. Implementation Notes

Non-obvious wiring that future changes must preserve:

- **Tailwind v4 source scanning:** `globals.css` declares `@source '../../../packages/omnysync-core/src'`. Tailwind v4 ignores `tailwind.config.ts` unless pulled in with `@config`, and it never scans `node_modules` (where the workspace package is linked). Removing that directive silently drops every core-only utility — dialog centering, zoom animations, etc.
- **i18n split:** Server Components resolve the locale from `Accept-Language` via `getT()`; Client Components use `useTranslations()`, which imports the `en`/`fr` dictionaries directly. A fetch-based client dictionary is deliberately avoided: a failed or rate-limited request used to render raw `UI_*` keys.
- **Locale source of truth:** `useSyncExternalStore` reads `<html lang>` on the client and returns `en` as the server snapshot, so FR visitors hydrate without losing server HTML or flashing a mismatch. `detectClientLocale()` (dates) follows the same rule, which keeps dates and copy in the same language even when the OS locale differs.
- **Server translations:** Server Components must call `await getT()` rather than the static `t()` — the latter defaults to English and silently produces mixed-language pages.
- **Serializable nav icons:** The shell is a Server Component, so nav items pass icon _names_ (`'dashboard'`, `'sync'`, …) resolved by `nav-icons.ts`. Component references cannot cross the server/client boundary.
- **Nav highlight helper:** `isNavItemActive(pathname, href)` lives in `src/lib/nav.ts` and is shared by the desktop sidebar and mobile drawer. `/dashboard` matches exactly (so nested pages don't light up both entries); `/admin` behaves as a section root and stays active across `/admin/*`.
