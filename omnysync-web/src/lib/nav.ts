/**
 * Whether a navigation item should be highlighted for the current pathname.
 *
 * The dashboard index (`/dashboard`) must only match exactly — otherwise every
 * nested route (`/dashboard/documents`, …) would light up both entries. The
 * admin entry is a section root, so it stays highlighted across `/admin/*`.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
