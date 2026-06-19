---
target: all pages & components (omnysync-web/src/app/ + omnysync-web/src/components/)
total_score: 24
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-06-15T17-45-11Z
slug: sync-web-src-app-pages-omnysync-web-src-components
---

# Omnysync Critique — All Pages & Components

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                                         |
| --------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3/4       | Good indicators overall; polling sync shows progress. App-level loading states present.                                           |
| 2         | Match System / Real World       | 3/4       | Mostly clear terminology. Mixed French/English across pages undermines consistency.                                               |
| 3         | User Control and Freedom        | 3/4       | Back navigation, cancel on dialogs. Few undo capabilities for destructive actions.                                                |
| 4         | Consistency and Standards       | **2/4**   | Mixed language (French/English). Inconsistent button rounding (pill vs default). Homepage nav built inline, not in shared layout. |
| 5         | Error Prevention                | 2/4       | Basic validation present. No autosave. Destructive confirms exist (good). No draft recovery.                                      |
| 6         | Recognition Rather Than Recall  | 3/4       | Icon+text sidebar nav is clear. Tabs well-labeled. Content visible in lists.                                                      |
| 7         | Flexibility and Efficiency      | **1/4**   | No keyboard shortcuts. No bulk operations. No customization. Single-path workflows.                                               |
| 8         | Aesthetic and Minimalist Design | 3/4       | Clean shadcn/ui base. Some pages dense (settings tabs). Generally well-spaced.                                                    |
| 9         | Error Recovery                  | 3/4       | Error boundaries, retry buttons, clear error messages. Log console for troubleshooting.                                           |
| 10        | Help and Documentation          | **1/4**   | No contextual help, no tooltips, no onboarding tour, no documentation links in-app.                                               |
| **Total** |                                 | **24/40** | **Acceptable**                                                                                                                    |

## Anti-Patterns Verdict

### LLM Assessment

This does NOT look AI-generated in the traditional slop sense. The shadcn/ui foundation gives it a professional, familiar SaaS appearance. No gradient text, no glassmorphism, no numbered 01/02/03 markers, no tiny uppercase eyebrows. The design is restrained and functional — appropriate for a product register.

However, the project suffers from identity diffusion: the existing `DESIGN.md` in `omnysync-web/` describes **Meta's** design system (Quest VR, Ray-Ban glasses) — cobalt buy-now buttons, Optimistic VF typography, hardware merchandising patterns — which has nothing to do with Omnysync's actual interface. This is a documentation liability: anyone reading DESIGN.md will be misled about the visual system.

### Deterministic Scan

**Detector ran on**: `omnysync-web/src/app/` (all pages) and `omnysync-web/src/components/` (all components)

- **1 finding**: `border-accent-on-rounded` in `dashboard/loading.tsx` line 5 — `border-b-2` on a rounded container. Low severity warning.

No issues found in components.

### Visual Overlays

No browser injection available — no dev server was running. Assessment based on source code review only.

## Overall Impression

Omnysync has a solid, workmanlike foundation. The shadcn/ui component library gives it a familiar, professionally-credible base. Dark mode is well-implemented. Loading, empty, and error states exist on most pages. The sync wizard's progressive disclosure is well thought out.

The biggest opportunity: **tightening consistency and adding polish.** Mixed language (French/English), inconsistent button styling, and the misleading DESIGN.md file erode the product's credibility. Power-user features (keyboard shortcuts, bulk actions) are entirely missing.

## What's Working

1. **Progressive disclosure in the sync wizard** (`sync/new/page.tsx`): The 5-step wizard reveals one decision at a time (source → document → destination → AI options → sync). Each step has clear back/continue affordances. The log console provides real-time feedback alongside the form. This is the best-designed flow in the app.

2. **Comprehensive state coverage**: Most pages handle loading (spinner/skeleton), empty (illustration + guidance), error (retry + message), and success states. The analytics page even distinguishes between "loading", "error", "empty data", and "real data" states — a maturity signal.

3. **Dark mode as a first-class citizen**: `globals.css` has a complete `.dark` token set with proper contrast ratios. Every page respects the theme. The ThemeToggle avoids hydration mismatch with a mounted check. This is well-executed.

## Priority Issues

### [P1] Mixed Language Across the UI — French and English interleaved

- **What**: Several pages mix English and French arbitrarily. Analytics page uses "Analytiques" as header but "Total synchronisations" in cards. Settings page is entirely in French. Webhooks page has `t('WEBHOOKS_TITLE') || 'Webhooks'` fallback to English. The sign-in page is entirely in English. The documents page uses French status labels ("En cours", "Échec").
- **Why it matters**: Inconsistent language undermines professionalism and confuses users. It signals the product is unfinished.
- **Fix**: Choose one language (recommend English as primary for SaaS tool). Complete the i18n translation coverage. Remove French hardcoded fallbacks. Audit every `.tsx` file for untranslated strings.
- **Suggested command**: `/impeccable clarify`

### [P1] Misleading DESIGN.md — describes Meta, not Omnysync

- **What**: `omnysync-web/DESIGN.md` documents Meta's hardware commerce design system (Quest VR, Ray-Ban glasses, Optimistic VF font, cobalt buy-now buttons, 100px pill shapes). It has zero relationship to Omnysync's actual shadcn/ui + Inter font + `#0064e0` primary design system.
- **Why it matters**: Anyone reading the design docs will be misled about colors, typography, components, and brand identity. This is actively harmful for onboarding and design decisions.
- **Fix**: Replace with auto-generated DESIGN.md from the actual codebase using `/impeccable document`.
- **Suggested command**: `/impeccable document`

### [P2] Inconsistent Button Rounding — pill vs. default radius

- **What**: Homepage CTAs use `rounded-full` (pill shape, 100px), but dashboard `Button` components use shadcn's default `--radius: 12px`. The Header component uses `rounded-full` for its "Get Started" button. The pricing page uses `rounded-full` on CTA buttons but the checkout uses shadcn default.
- **Why it matters**: Inconsistent affordances erode trust. Users subconsciously learn that "this shape = this kind of action." When the shape changes arbitrarily, that learning breaks.
- **Fix**: Decide on ONE button radius. Either commit to pills everywhere (matching the header) or standardize on shadcn's radius. Apply consistently.
- **Suggested command**: `/impeccable polish`

### [P2] No Keyboard Shortcuts, Bulk Actions, or Power User Features

- **What**: The entire app has zero keyboard shortcuts. No bulk select/delete for documents. No batch sync operations. No way to quickly navigate between pages without clicking. No command palette.
- **Why it matters**: Power users (the primary audience — content teams managing multiple platforms daily) will feel the friction. Every action requires multiple clicks. This increases cognitive load and reduces throughput.
- **Fix**: Add keyboard navigation (jk for nav, / to search, Escape to close modals). Add bulk selection + batch actions to document lists.
- **Suggested command**: `/impeccable shape` (plan power features) then `/impeccable craft` (build)

### [P2] `--muted-foreground` Contrast Fails WCAG AA

- **What**: `--muted-foreground: #5d6c7b` against `--background: #ffffff` gives approximately 3.7:1 contrast ratio, below the 4.5:1 WCAG AA minimum for body text. This color is used extensively for secondary text, descriptions, and labels throughout the app.
- **Why it matters**: Users with visual impairments (or even users in bright environments) will struggle to read secondary text. This is a legal accessibility risk.
- **Fix**: Darken `--muted-foreground` to at least #4a5568 (or calculate exact value for 4.5:1 against white). Ensure dark mode variant also passes.
- **Suggested command**: `/impeccable audit`

### [P3] Homepage Navigation Architecture — inline nav vs. shared Header

- **What**: The homepage has its own `<nav>` element embedded in `page.tsx`. The root layout's `<Header />` component explicitly returns `null` on `pathname === '/'`. The pricing page gets the shared Header but no page-level nav. This is two different navigation approaches coexisting.
- **Why it matters**: Maintenance burden. Changes to navigation must be made in two places. The homepage nav has different styling (inline links vs. shadcn Button components in Header).
- **Fix**: Either refactor the homepage to use the shared Header, or remove the Header routing exception and standardize on page-level nav for public pages.
- **Suggested command**: `/impeccable distill`

### [P3] No In-App Help, Documentation, or Onboarding

- **What**: Beyond a "Getting Started" card on the dashboard with 3 numbered steps, there is no contextual help, tooltip guidance, documentation links, or onboarding tour anywhere in the app.
- **Why it matters**: First-time users (Jordan persona) will struggle to understand the sync workflow. The 5-step wizard is self-explanatory, but the connector setup, webhook configuration, and approval flows have no guidance.
- **Fix**: Add inline help tooltips on complex forms. Add a documentation link in the sidebar footer. Consider a lightweight onboarding checklist.
- **Suggested command**: `/impeccable onboard`

## Persona Red Flags

### Jordan (Confused First-Timer)

- The mixed French/English UI will confuse a first-timer. Sign-in page is English, dashboard is English, but settings, analytics, and webhooks pages are French. Jordan won't know what language to expect.
- The sidebar nav has icon+text labels (good), but terms like "Connecteurs" vs "Connectors" in different places creates uncertainty.
- No tooltips, no onboarding tour, no contextual help. Jordan lands on the dashboard and sees a "Getting Started" card with 3 steps, but no clear "what do I do first" guidance.
- The sync wizard is the best flow — its progressive disclosure guides Jordan well. But getting to it requires first setting up connectors, which has no step-by-step guidance.

### Alex (Power User)

- Zero keyboard shortcuts detected. Alex will be frustrated immediately.
- Document list has no bulk selection or batch operations. Each document must be managed individually.
- No command palette. No "/" search. No quick navigation between pages.
- Sync status pages reload data on navigation but offer no real-time push updates (polling only).
- The 120-second polling timeout in the sync wizard means Alex might walk away rather than watch.

### Sam (Accessibility-Dependent User)

- `--muted-foreground` at 3.7:1 contrast fails WCAG AA — this affects every description, secondary text, and label in the app.
- Focus-visible styles exist (2px ring via `*:focus-visible` in globals.css) ✓
- The ThemeToggle uses `rotate` transitions for the sun/moon icon swap. With `prefers-reduced-motion: reduce`, this may still animate.
- The loading spinner uses `animate-spin` which cannot be paused. Sam with vestibular disorders may be affected.
- The ConnectorDialog has `aria-hidden="true"` on decorative icons and `role="alert"` on errors — good practice ✓
- Mobile drawer uses `aria-label` on menu buttons ✓

## Minor Observations

1. **Dashboard loading.tsx** has `border-b-2` on a rounded div — the detector flagged this. It's a minor visual inconsistency.
2. **Pricing page** has a `ProCheckoutButton` component that wraps a form. The "Contact Sales" CTA uses `mailto:` — consider a contact form instead.
3. **The landing page platform logos** section uses a generic `<Globe>` icon for every platform (WordPress, Ghost, etc.) instead of branded logos. This reduces trust.
4. **The 404 page** handles both routes with a `Home` and `Sign In` button — good, but the sign-in button goes directly to `/auth/signin` instead of encouraging back-navigation.
5. **Analytics bar chart** renders bars with inline `style={{ height }}` — works but is fragile. Consider a proper charting library for production.
6. **The `connector-dialog.tsx`** uses a hardcoded success timeout (1500ms) before closing — this could feel abrupt.
7. **Settings > Danger Zone** card uses `border-destructive` correctly but the delete button is inside a flex container that doesn't align well at mobile widths.
8. **The usage page** has demo/fallback data (`demoUsage`) mixed with real API data — risky pattern that could ship demo data to production.
9. **Global error.tsx** shows `error.message` directly in the UI — this could expose sensitive information.
10. **The sitemap and robots.ts** exist but the API endpoints don't have proper rate limiting visible from the public pages.

## Questions to Consider

1. **"What if the app spoke one language consistently?"** — The mixed French/English is the single most impactful fix. It touches every page and signals "unfinished" louder than any design flaw.

2. **"Does the DESIGN.md liability need immediate attention?"** — Having Meta's design doc masquerading as Omnysync's is actively harmful. Anyone making design decisions based on this document will produce off-brand work.

3. **"What would a power-user mode look like?"** — Content teams using this daily need bulk operations, keyboard shortcuts, and faster workflows. Could this be a competitive differentiator?
