# Product

## Register

product

## Users

**Content teams, agencies, and individual creators** who need to move content from a source platform to a destination CMS (WordPress, Ghost, Webflow, Shopify, Contentful, Medium). They are:

- **Marketing/content managers** who copy the same document into a CMS by hand and want a repeatable route
- **Agencies** managing client sites who need centralized content operations and a clear sync history
- **Individual creators** who want to publish from their writing tool to one destination without manual copy-paste

Their context: typically in-browser, task-oriented, and working with one source and one destination per sync. They value speed, reliability, and visibility into what's happening.

## Product Purpose

Omnysync is a content routing platform. Each sync moves one document from one source to one destination. It lets users:

- **Route content** — connect sources (Google Docs, Notion, Airtable, Contentful) to destinations (WordPress, Ghost, Webflow, Shopify, Contentful, Medium)
- **Schedule recurring syncs** — keep a destination up to date on Pro and Business plans
- **Enrich with AI (beta)** — generate SEO metadata during sync when the plan includes AI features; images and automatic internal linking are not advertised as current features
- **Track and manage** — see sync status, history, analytics, usage, and errors for each document
- **Collaborate** — manage team members and roles

Success looks like: users stop manually copying a document from their source into their destination CMS.

## Brand Personality

**Efficient. Reliable. Modern.**

- **Efficient**: Every interaction saves time. No unnecessary steps, no clutter.
- **Reliable**: Trustworthy and stable. Sync status is always visible, errors are clear and recoverable.
- **Modern**: Clean, minimal, technically confident. Not trendy — precise.

The emotional goal is **confidence**: users should feel in control of their content pipeline, never anxious about whether something synced correctly.

## Anti-references

- **Overly complex enterprise tools** with dense data tables, endless configuration panels, and steep learning curves (e.g., traditional enterprise CMS backends)
- **Noisy dashboards** with competing visual priorities, excessive animations, and decorative elements that obscure the primary task
- **"Card-grid-as-default" layouts** where every piece of content gets the same visual weight regardless of importance
- **The AI slop aesthetic**: gradient text, glassmorphism, numbered 01/02/03 section markers, and tiny uppercase eyebrow labels above every section
- **SaaS-cream default**: generic warm-neutral backgrounds with zero brand identity

## Design Principles

1. **Clarity-first, always**: Every screen has one clear primary action. Status is always visible. The user never wonders "did it work?"

2. **Progressive disclosure**: Show what's needed now, hide the rest. Complex workflows (like the 5-step sync wizard) reveal one decision at a time.

3. **Confident minimalism**: Generous whitespace, purposeful color use, restrained typography. Every element earns its place.

4. **Transparency breeds trust**: Sync logs, progress indicators, error messages with recovery paths — visibility into the system builds user confidence.

5. **Consistency is a feature**: Same patterns, same terminology, same behaviors across every surface. Once learned, never re-learned.

## Accessibility & Inclusion

- Target **WCAG AA** as a baseline (4.5:1 contrast for body text, 3:1 for large text)
- Full **keyboard navigation** support across all interactive elements
- **Reduced motion** respected via `prefers-reduced-motion` media query
- **Dark mode** as a first-class citizen, not an afterthought
- Error messages in **plain language**, not technical jargon
- Touch targets at least **44×44px** on interactive elements
- Screen reader support via ARIA labels and semantic HTML
