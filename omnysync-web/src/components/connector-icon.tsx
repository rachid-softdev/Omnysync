import {
  FileText,
  StickyNote,
  Database,
  Layout,
  Globe,
  ShoppingCart,
  Table,
  Box,
  Newspaper,
} from 'lucide-react'

const iconMap: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  GOOGLE_DOCS: { icon: FileText, color: '#4285F4', bg: '#E8F0FE' },
  NOTION: { icon: StickyNote, color: '#000000', bg: '#F0F0F0' },
  WORDPRESS: { icon: Globe, color: '#21759B', bg: '#E8F0F8' },
  GHOST: { icon: Layout, color: '#15171A', bg: '#F0F0F0' },
  WEBFLOW: { icon: Globe, color: '#4353FF', bg: '#EDEFFF' },
  SHOPIFY: { icon: ShoppingCart, color: '#96BF48', bg: '#F4F9ED' },
  AIRTABLE: { icon: Table, color: '#FF4F00', bg: '#FFF0E6' },
  CONTENTFUL: { icon: Box, color: '#FFB000', bg: '#FFF7E6' },
  MEDIUM: { icon: Newspaper, color: '#00AB6C', bg: '#E6F9F1' },
}

export function ConnectorIcon({
  type,
  className = 'w-10 h-10',
}: {
  type: string
  className?: string
}) {
  const config = iconMap[type]
  if (!config)
    return (
      <div
        className={`${className} rounded-full bg-muted flex items-center justify-center text-lg`}
      >
        ?
      </div>
    )

  const Icon = config.icon
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center`}
      style={{ backgroundColor: config.bg }}
      aria-hidden="true"
    >
      <Icon className="w-5 h-5" style={{ color: config.color }} />
    </div>
  )
}
