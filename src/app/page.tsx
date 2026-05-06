import Link from "next/link";
import { ArrowRight, Zap, Globe, BarChart3, ArrowDownUp, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-32 pb-32 bg-background">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">Omnysync</Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
              <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How it Works</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground">Sign In</Link>
              <ThemeToggle />
              <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <main className="max-w-4xl mx-auto px-6 text-center mt-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium text-muted-foreground mb-6">
            <Zap className="w-4 h-4" />
            <span>Sync your content in seconds, not hours</span>
          </div>
          
          {/* Hero Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your content, everywhere.
            <br />
            <span className="text-muted-foreground">Perfectly in sync.</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect your content sources once, publish everywhere. Save hours every week with automatic synchronization across all your platforms.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get Started
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <Link href="#features" className="inline-flex items-center justify-center rounded-full border border-input px-8 py-4 text-sm font-medium hover:bg-accent">
              See Features
            </Link>
          </div>
          
          <p className="text-sm text-muted-foreground">
            No credit card required • Free plan available
          </p>
        </main>

        {/* Platform Logos */}
        <div className="mt-16 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground mb-6">Connect with your favorite platforms</p>
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-50">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">WordPress</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Ghost</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Webflow</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Shopify</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Notion</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything you need to sync</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Powerful features to manage your content workflow without the headache
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <ArrowDownUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Two-way Sync</h3>
              <p className="text-sm text-muted-foreground">Keep content in sync both directions. Changes update everywhere automatically.</p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-time Analytics</h3>
              <p className="text-sm text-muted-foreground">Track performance across all platforms from one dashboard.</p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Scheduling</h3>
              <p className="text-sm text-muted-foreground">Schedule posts for optimal times across different time zones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 bg-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Get started in minutes, not days
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2">Connect</h3>
              <p className="text-sm text-muted-foreground">Link your content sources and platforms</p>
            </div>

            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2">Create</h3>
              <p className="text-sm text-muted-foreground">Write once, publish everywhere</p>
            </div>

            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2">Sync</h3>
              <p className="text-sm text-muted-foreground">Automatic updates across all platforms</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start Syncing Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to simplify your workflow?</h2>
          <p className="text-primary-foreground/80 mb-8">
            Join thousands of creators who save hours every week with Omnysync
          </p>
          <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-background px-8 py-4 text-sm font-medium text-foreground hover:bg-background/90">
            Get Started Free
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-lg font-bold">Omnysync</div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Omnysync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}