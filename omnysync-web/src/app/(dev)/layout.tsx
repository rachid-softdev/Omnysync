import { notFound } from 'next/navigation'
import { Schibsted_Grotesk } from 'next/font/google'

const fontSans = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap' })

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.className} min-h-screen bg-white text-[#0f172a]`}>
        {children}
      </body>
    </html>
  )
}
