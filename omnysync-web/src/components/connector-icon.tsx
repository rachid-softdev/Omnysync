import {
  FileText,
  StickyNote,
  PanelLeft,
  Globe,
  ShoppingBag,
  TableIcon,
  Package,
  NewspaperIcon,
} from 'lucide-react'

const iconMap: Record<string, typeof FileText> = {
  GOOGLE_DOCS: FileText,
  NOTION: StickyNote,
  WORDPRESS: Globe,
  GHOST: PanelLeft,
  WEBFLOW: Globe,
  SHOPIFY: ShoppingBag,
  AIRTABLE: TableIcon,
  CONTENTFUL: Package,
  MEDIUM: NewspaperIcon,
}

/**
 * Neutral connector chip. Brand glyphs stay recognizable through the icon
 * shape while all color comes from semantic tokens (light + dark mode safe).
 */
export function ConnectorIcon({
  type,
  className = 'size-10',
}: {
  type: string
  className?: string
}) {
  const Icon = iconMap[type]

  return (
    <div
      className={`${className} grid shrink-0 place-items-center rounded-[3px] border border-border bg-muted`}
      aria-hidden="true"
    >
      {Icon ? (
        <Icon className="size-1/2 text-muted-foreground" />
      ) : (
        <span className="text-sm text-muted-foreground">?</span>
      )}
    </div>
  )
}
