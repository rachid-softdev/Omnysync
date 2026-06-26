// ---------------------------------------------------------------------------
// Stub pour dependances manquantes (non installees ou non resolues par TS)
// ---------------------------------------------------------------------------

declare module 'dotenv' {
  export function config(options?: { path?: string; override?: boolean }): { parsed?: Record<string, string> }
}

declare module 'prisma/config' {
  export const defineConfig: (config: unknown) => unknown
}

declare module '@auth/core/adapters' {
  export interface Adapter {
    [key: string]: unknown
  }
}

declare module 'tailwindcss' {
  export interface Config {
    darkMode?: string | string[]
    content?: string[]
    theme?: Record<string, unknown>
    plugins?: unknown[]
    presets?: unknown[]
    prefix?: string
    important?: boolean | string
    separator?: string
    safelist?: Array<string | { pattern: string; variants?: string[] }>
    blocklist?: string[]
    [key: string]: unknown
  }
}

declare module 'tailwindcss-animate' {
  const plugin: { handler: () => void; __isPluginFunction: true }
  export default plugin
}

// lucide-react icons manquants dans la version 0.510.0
declare module 'lucide-react' {
  export const StickyNote: React.FC<React.SVGProps<SVGSVGElement>>
  export const PanelLeft: React.FC<React.SVGProps<SVGSVGElement>>
  export const ShoppingBag: React.FC<React.SVGProps<SVGSVGElement>>
  export const TableIcon: React.FC<React.SVGProps<SVGSVGElement>>
  export const Package: React.FC<React.SVGProps<SVGSVGElement>>
  export const NewspaperIcon: React.FC<React.SVGProps<SVGSVGElement>>
  export const Building2: React.FC<React.SVGProps<SVGSVGElement>>
  export const Puzzle: React.FC<React.SVGProps<SVGSVGElement>>
  export const Search: React.FC<React.SVGProps<SVGSVGElement>>
  export const CheckCircle2: React.FC<React.SVGProps<SVGSVGElement>>
  export const Info: React.FC<React.SVGProps<SVGSVGElement>>
  export const ToggleLeft: React.FC<React.SVGProps<SVGSVGElement>>
}
