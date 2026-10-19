import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Building2,
  CreditCard,
  FileCheck,
  FileText,
  LayoutDashboard,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ToggleLeft,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Registry of navigation icons.
 *
 * Server Components cannot pass component references to Client Components, so
 * navigation data crossing that boundary carries an icon *name* instead. The
 * client resolves it back to a component with `resolveNavIcon`.
 */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  documents: FileText,
  connectors: Plug,
  sync: ArrowRightLeft,
  analytics: BarChart3,
  webhooks: Webhook,
  approvals: FileCheck,
  usage: Zap,
  settings: Settings,
  admin: Shield,
  users: Users,
  orgs: Building2,
  overrides: ToggleLeft,
  health: Activity,
  logs: ScrollText,
  audit: ScrollText,
  billing: CreditCard,
} as const

export type NavIconName = keyof typeof NAV_ICONS

/** Icon prop accepted by nav components: a serializable name or a component. */
export type NavIcon = NavIconName | LucideIcon

export function resolveNavIcon(icon: NavIcon): LucideIcon {
  return typeof icon === 'string' ? NAV_ICONS[icon] : icon
}
