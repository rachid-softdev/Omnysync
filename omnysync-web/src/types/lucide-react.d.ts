// Type declarations for lucide-react (v1.x)
// The package declares types at dist/lucide-react.d.ts but the file is not bundled
// due to incomplete pnpm junction. This declaration satisfies the type checker.
// When you add a new lucide-react icon import, add its declaration here.
declare module "lucide-react" {
  import type { FC, SVGProps } from "react";

  type IconComponent = FC<SVGProps<SVGSVGElement> & { size?: number | string }>;

  export const AlertCircle: IconComponent;
  export const AlertTriangle: IconComponent;
  export const ArrowLeft: IconComponent;
  export const ArrowRight: IconComponent;
  export const ArrowRightLeft: IconComponent;
  export const ArrowUpDown: IconComponent;
  export const BarChart3: IconComponent;
  export const Bell: IconComponent;
  export const Building: IconComponent;
  export const Calendar: IconComponent;
  export const Check: IconComponent;
  export const CheckCircle: IconComponent;
  export const ChevronDown: IconComponent;
  export const ChevronLeft: IconComponent;
  export const ChevronRight: IconComponent;
  export const ChevronUp: IconComponent;
  export const CircleDot: IconComponent;
  export const CircleX: IconComponent;
  export const Clock: IconComponent;
  export const Copy: IconComponent;
  export const CreditCard: IconComponent;
  export const Crown: IconComponent;
  export const Database: IconComponent;
  export const Edit: IconComponent;
  export const ExternalLink: IconComponent;
  export const Eye: IconComponent;
  export const FileCheck: IconComponent;
  export const FileText: IconComponent;
  export const Globe: IconComponent;
  export const Home: IconComponent;
  export const Image: IconComponent;
  export const Key: IconComponent;
  export const LayoutDashboard: IconComponent;
  export const Link2: IconComponent;
  export const Loader2: IconComponent;
  export const LogOut: IconComponent;
  export const Mail: IconComponent;
  export const Menu: IconComponent;
  export const Moon: IconComponent;
  export const MoreHorizontal: IconComponent;
  export const MoreVertical: IconComponent;
  export const Play: IconComponent;
  export const Plug: IconComponent;
  export const Plus: IconComponent;
  export const RefreshCw: IconComponent;
  export const Send: IconComponent;
  export const Settings: IconComponent;
  export const Shield: IconComponent;
  export const Square: IconComponent;
  export const Sun: IconComponent;
  export const Trash2: IconComponent;
  export const TrendingDown: IconComponent;
  export const TrendingUp: IconComponent;
  export const Upload: IconComponent;
  export const User: IconComponent;
  export const UserPlus: IconComponent;
  export const Users: IconComponent;
  export const Wand2: IconComponent;
  export const Webhook: IconComponent;
  export const X: IconComponent;
  export const XCircle: IconComponent;
  export const Zap: IconComponent;

  export function createLucideIcon(name: string): IconComponent;
}
