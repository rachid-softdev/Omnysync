---
name: Omnysync
description: Multi-platform content synchronization platform with a clean, confident product UI.
colors:
  primary: "#0064e0"
  primary-hover: "#0457cb"
  primary-soft: "#0091ff"
  on-primary: "#ffffff"
  background: "#ffffff"
  foreground: "#1c1e21"
  card: "#ffffff"
  card-foreground: "#1c1e21"
  surface-soft: "#f1f4f7"
  muted: "#f1f4f7"
  muted-foreground: "#5d6c7b"
  accent: "#f1f4f7"
  accent-foreground: "#1c1e21"
  destructive: "#e41e3f"
  destructive-foreground: "#ffffff"
  border: "#ced0d4"
  input: "#ced0d4"
  ring: "#0064e0"
  sidebar-bg: "#f1f4f7"
  sidebar-foreground: "#1c1e21"
  sidebar-primary: "#0064e0"
  sidebar-primary-foreground: "#ffffff"
  sidebar-border: "#ced0d4"
  dark-background: "#0a1317"
  dark-foreground: "#ffffff"
  dark-card: "#1c1e21"
  dark-surface-soft: "#444950"
  dark-muted: "#444950"
  dark-muted-foreground: "#8595a4"
  dark-accent: "#444950"
  dark-accent-foreground: "#ffffff"
  dark-border: "#444950"
  dark-input: "#444950"
  dark-ring: "#0091ff"
  dark-sidebar-bg: "#1c1e21"
  dark-sidebar-foreground: "#ffffff"
  dark-sidebar-border: "#444950"
  success: "#22c55e"
  warning: "#eab308"
  error: "#e41e3f"
typography:
  display:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
  heading-1:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
  heading-2:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.25
  heading-3:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
  heading-4:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  caption:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
  label:
    fontFamily: Inter, system-ui, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
  code:
    fontFamily: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 8px
  md: 10px
  lg: 12px
  xl: 16px
  xxl: 22px
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
    padding: 12px 24px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
    border: 1px solid '{colors.border}'
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 10px 20px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
  button-pill-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px 32px
  button-pill-secondary:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 12px 32px
    border: 1px solid '{colors.border}'
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
    border: 1px solid '{colors.border}'
  card-hover:
    shadow: 0 4px 12px rgba(0, 0, 0, 0.08)
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    height: 44px
    border: 1px solid '{colors.input}'
  input-focused:
    border: 2px solid '{colors.ring}'
  input-error:
    border: 1px solid '{colors.destructive}'
  badge:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
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
  separator:
    backgroundColor: "{colors.border}"
    height: 1px
  tab-trigger:
    backgroundColor: transparent
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: 8px 16px
  tab-trigger-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
  skeleton:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.sm}"
  progress:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.full}"
    height: 8px
  progress-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
  select-trigger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    height: 44px
    border: 1px solid '{colors.input}'
  switch:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.full}"
    height: 24px
    width: 44px
  switch-checked:
    backgroundColor: "{colors.primary}"
  avatar:
    rounded: "{rounded.full}"
    size: 40px
  alert-dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: 24px
---

# Design System: Omnysync

## 1. Overview

**Creative North Star: "The Reliable Publisher"**

Omnysync is a workman's tool for content operations — the interface should feel like a well-organized workshop, not a showroom. Every pixel earns its place by helping the user publish, sync, and manage content across platforms with confidence. The aesthetic is restrained, functional, and technically credible: clean white surfaces, a single cobalt accent for primary actions, generous whitespace around decision points, and the familiar comfort of shadcn/ui's proven component vocabulary.

This system explicitly rejects: noisy dashboards with competing visual priorities, decorative embellishments that don't serve the task, "SaaS-cream" warm-neutral backgrounds that say nothing, and the generic card-grid-as-default layout pattern. The interface should disappear into the task — users should think about their content, not about the tool.

**Key Characteristics:**

- Cobalt blue (`#0064e0`) as the single accent color, used sparingly for primary actions and interactive state indicators only
- White canvas (`#ffffff`) as the default background, with a soft gray surface layer (`#f1f4f7`) for sidebars and secondary panels
- Inter type family throughout — no display/body pairing; one confident sans carries all roles from 48px display to 12px caption
- Consistent rounded corners (12px default radius) with pill-shaped variants for badges and marketing CTAs
- Flat-by-default elevation with subtle shadows reserved for interactive feedback
- Dark mode as a first-class citizen with full token parity
- Strong state coverage: loading, empty, error, and success states on every major surface

## 2. Colors

The palette follows a Restrained strategy: white canvas + single cobalt accent + neutral grays for hierarchy.

### Primary

- **Cobalt Blue** (`#0064e0`): The sole accent color. Used for primary CTAs, active navigation indicators, link text, focus rings, and the active tab state. Never used decoratively.
- **Cobalt Hover** (`#0457cb`): Pressed state for primary buttons and interactive elements.
- **Cobalt Soft** (`#0091ff`): Dark-mode primary variant. Brighter to maintain contrast against dark backgrounds.

### Semantic

- **Success Green** (`#22c55e`): Sync-completed indicators, "in stock" badges, positive confirmation toasts.
- **Warning Yellow** (`#eab308`): Medium-priority alerts, near-limit usage warnings.
- **Error Red** (`#e41e3f`): Destructive actions, sync failure indicators, validation errors.

### Neutral

- **White** (`#ffffff`): Page canvas and primary card surface.
- **Soft Gray** (`#f1f4f7`): Sidebar background, muted surface, accent container, thumbnail backgrounds.
- **Ink** (`#1c1e21`): Primary text color for headings and body copy.
- **Muted Text** (`#5d6c7b`): Secondary text for descriptions, metadata, and supporting copy.
- **Border** (`#ced0d4`): Card borders, input strokes, dividers, and separators.

### Dark Mode

- **Deep Ink** (`#0a1317`): Dark canvas and page background.
- **Dark Card** (`#1c1e21`): Card and elevated surface backgrounds.
- **Dark Surface** (`#444950`): Muted surfaces, sidebar backgrounds, secondary containers.
- **Dark Muted Text** (`#8595a4`): Secondary text on dark surfaces.
- **Dark Border** (`#444950`): Card borders, input strokes on dark backgrounds.

### Named Rules

**The One Accent Rule.** Cobalt blue is the only accent color. It appears on primary buttons, focus rings, active states, and links — covering ≤10% of any given screen. Its rarity is the point. If a new accent color is needed, it must earn its place through a specific semantic role (success/warning/error), not decoration.

**The Dark Mode Parity Rule.** Every light-mode token has a corresponding dark-mode token. Dark mode is not an afterthought — it's compiled from the same component system with inverted neutrals and a brighter primary variant for contrast.

## 3. Typography

**Display & Body Font:** Inter (with system-ui, -apple-system, sans-serif fallback). Loaded from Google Fonts via `next/font/google` with `display: swap`.

**Code/Mono Font:** `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace` — the system monospace stack. Used in log consoles, error detail blocks, and technical displays.

**Character:** Inter is a workhorse humanist sans-serif — legible, neutral, and unpretentious. It carries the full hierarchy from 48px display headlines to 12px caption text without needing a secondary face. The single-family approach avoids the display/body pairing headache and keeps the interface feeling consistent and tool-like.

### Hierarchy

| Token      | Size | Weight | Line Height | Use                                           |
| ---------- | ---- | ------ | ----------- | --------------------------------------------- |
| Display    | 48px | 700    | 1.1         | Landing page hero headlines, section openers  |
| Heading 1  | 36px | 700    | 1.2         | Page titles, section headers                  |
| Heading 2  | 30px | 700    | 1.25        | Dashboard page titles, modal headers          |
| Heading 3  | 24px | 600    | 1.3         | Card titles, subsection headers               |
| Heading 4  | 20px | 600    | 1.35        | Feature tile titles, form section labels      |
| Body       | 16px | 400    | 1.5         | Primary reading text, 65–75ch max line length |
| Body Small | 14px | 400    | 1.43        | Secondary text, descriptions, metadata        |
| Caption    | 12px | 400    | 1.33        | Timestamps, badge labels, footer fine print   |
| Label      | 14px | 500    | 1.43        | Button labels, form labels, tab text          |
| Code       | 14px | 400    | 1.5         | Log consoles, error messages, code displays   |

### Named Rules

**The One Family Rule.** Inter carries every role. No display font, no editorial serif, no brand face. The product UI confidence comes from consistent weight and size contrast, not from font switching.

**The Fixed Scale Rule.** Product UI uses fixed px/rem sizes, not fluid clamp(). Users view at consistent DPI; fluid type adds complexity without benefit in a dashboard context.

## 4. Elevation

The system is predominantly flat. Depth is conveyed through tonal layering (light gray surfaces on white canvas) rather than shadows. Shadows are used sparingly and only as interactive feedback, not as a decorative layer.

### Shadow Vocabulary

- **Card Hover** (`0 4px 12px rgba(0, 0, 0, 0.08)`): Subtle elevation when hovering over selectable cards. Used on connector cards and document list items.
- **Active Tab** (`0 1px 3px rgba(0, 0, 0, 0.1)`): Indicates the selected tab is elevated above inactive tabs.
- **Modal Backdrop** (none; uses `background: rgba(0, 0, 0, 0.5)` overlay instead): Dialogs and modals use a scrim to create depth, not a shadow on the dialog itself.
- **Sticky Panel** (none for the panel; bottom bar uses `1px solid {colors.border}` top border): Purchase rails and summary panels are distinguished by position and border, not shadow.

### Named Rules

**The Flat-by-Default Rule.** Surfaces are flat at rest. No ambient shadows on cards, no elevation for decorative purposes. Shadows appear only as a response to interaction (hover, active, selected).

**The Tonal Layer Rule.** When hierarchy is needed between flat surfaces, use background color contrast (white canvas → soft gray sidebar → deep ink dark mode) rather than shadows. The sidebar, cards, and content area are distinguished by surface color, not z-index.

## 5. Components

### Buttons

- **Shape:** 12px rounded corners (`rounded.lg`) for dashboard buttons; pill-shaped (`rounded.full`) for marketing CTAs on landing pages
- **Primary:** Cobalt blue (`#0064e0`) background, white text. Used for primary actions: "Create", "Save", "Sync", "Connect"
- **Hover:** Deepens to `#0457cb`
- **Disabled:** Opacity 50%
- **Secondary:** Transparent background, ink text, `1px solid {colors.border}` stroke. Used for secondary or cancel actions
- **Ghost:** Transparent, no border. Used for inline toolbar actions and less prominent controls
- **Destructive:** Red (`#e41e3f`) background, white text. Used for delete, remove, and other destructive confirmations
- **Loading:** All button variants show a spinner replacing the icon slot during async operations

### Cards

- **Shape:** 12px rounded corners, `1px solid {colors.border}` stroke
- **Background:** White (`#ffffff`), or dark card (`#1c1e21`) in dark mode
- **Padding:** 24px standard (`p-6`), 16px compact variant for dense lists
- **Shadow:** None at rest. On hover for selectable cards: `0 4px 12px rgba(0, 0, 0, 0.08)`
- **Internal spacing:** 16px between child elements
- **Nested cards are prohibited.** If a card needs internal grouping, use a border separator or background tint instead

### Inputs & Form Controls

- **Shape:** 12px rounded corners, `1px solid {colors.input}` stroke
- **Height:** 44px standard (meets WCAG AAA touch target)
- **Background:** White (light) or `#1c1e21` (dark)
- **Focus:** `2px solid {colors.ring}` replaces the stroke on focus-visible. No glow, no shadow
- **Error:** Stroke switches to `1px solid {colors.destructive}`; inline error message below in red body-sm
- **Disabled:** Muted background (`{colors.muted}`) with reduced opacity
- **Select:** Same shape as inputs, with a chevron icon on the right
- **Textarea:** Same styling as inputs, minimum 100px height, resizable vertically

### Navigation

- **Desktop Sidebar:** 256px wide, soft gray background (`#f1f4f7`). Icon + text labels, 44px clickable items. Active state uses subtle background tint. Bottom section has user avatar, name, and logout
- **Mobile Drawer:** Full-height slide-in from left, 280px wide. Overlay backdrop at 50% opacity. Close button top-right. Same nav items as desktop
- **Top Bar (public pages):** Fixed header with logo left, nav links center (hidden on mobile), CTA buttons right. Background at 80% opacity with `backdrop-blur-sm`
- **Breadcrumbs:** Body-sm text, steel-gray separators. Used on document detail and sync detail pages
- **Tab Navigation:** Pill-style tabs for switching between views within a page. Active tab: white background, 12px rounded, subtle shadow

### Badges & Status Indicators

- **Shape:** Pill-shaped (`rounded.full`), 4px 10px padding
- **Default:** Soft gray background, standard text. Used for neutral status ("Member", "Inactive")
- **Primary:** Cobalt background, white text. Used for active status ("Active", "Pro")
- **Destructive:** Red background, white text. Used for error states ("Failed", "Error")
- **Outline:** Transparent with border. Used for secondary status labels
- **Semantic dot indicators:** Colored dots (green/red/yellow) next to sync log entries for quick status scanning

### Progress & Loading

- **Progress Bar:** 8px height, pill-shaped (`rounded.full`). Muted gray track, cobalt fill. Used on sync progress and usage limit displays
- **Loading Spinner:** 32px animated spinner for page-level loading. 16px for inline button loading
- **Skeleton:** Soft gray rounded rectangles matching the shape of the content being loaded. Used on dashboard cards before data arrives
- **Empty State:** Centered layout with icon + heading + description + optional action button. Used on all list pages when no data exists

### Dialogs & Modals

- **Shape:** 16px rounded corners, 24px padding
- **Backdrop:** `rgba(0, 0, 0, 0.5)` overlay
- **Width:** `max-w-md` (448px) standard, `max-w-lg` (512px) for forms
- **Header:** Title + description + optional close X button
- **Footer:** Action buttons right-aligned (primary + cancel)
- **Dismiss:** Escape key, click-outside, and explicit cancel/close affordance

### Sync Console

- **Background:** Muted surface (`{colors.muted}`), monospace font, 14px
- **Log format:** `[timestamp] ✓/✗/ℹ action: message` with color-coding (green = success, red = error, blue = info, yellow = warning)
- **Max height:** 400px with overflow-y scroll for long sync sessions
- **Empty state:** "Waiting for activity..." in muted text

## 6. Do's and Don'ts

### Do:

- **Do** use cobalt blue (`#0064e0`) for primary actions only — its visual weight is meaningful because it's rare
- **Do** use pill-shaped badges for status labels and tags — the pill shape signals "metadata, not action"
- **Do** use the sidebar icon + text pattern consistently — every nav item has both an icon and a text label
- **Do** provide loading, empty, error, and success states for every major data-fetching surface
- **Do** use progressive disclosure for complex workflows — the 5-step sync wizard is the model pattern
- **Do** maintain dark mode token parity — every surface should work in both modes without layout changes
- **Do** follow the 12px corner radius for interactive elements (buttons, inputs, cards) and pill shapes for badges
- **Do** use Inter for all typography — one family, consistent weights, no mixing
- **Do** keep destructive actions behind confirmation dialogs — delete, remove, and revoke always require a second click

### Don't:

- **Don't** introduce additional accent colors beyond cobalt blue — the restrained palette is intentional
- **Don't** use decorative embellishments (gradient text, glassmorphism, heavy shadows, animated backgrounds) — this is a tool, not a showcase
- **Don't** mix button shapes on the same surface — all dashboard buttons use 12px corners, all marketing CTAs use pills. Never both on the same page
- **Don't** nest cards — use borders, background tints, or inline separators instead
- **Don't** use modals as a first default — exhaust inline expansions, side panels, and progressive disclosure first
- **Don't** ship with missing states — every list page needs loading, empty, error, and populated states
- **Don't** hardcode French labels in English UI (or vice versa) — use the i18n translation system for all user-facing text
- **Don't** add keyboard shortcuts without documenting them — power features should be discoverable
- **Don't** use numbered section markers (01/02/03) as generic scaffolding — numbers are reserved for actual sequential processes (like the sync wizard steps)
- **Don't** use side-stripe borders (border-left/right >1px as colored accents) — use full borders, background tints, or nothing
- **Don't** use animated page-load sequences — product users are in flow and shouldn't wait for choreography
