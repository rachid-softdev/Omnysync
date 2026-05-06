import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <h1 className="text-9xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold mt-4 mb-2">Page not found</h2>
        <p className="text-muted-foreground mb-8">
          Sorry, we couldn't find the page you're looking for.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Home className="w-4 h-4 mr-2" />
            Go back home
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-full border border-input px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}