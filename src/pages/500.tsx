import Link from "next/link";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";

export default function Custom500() {
  return (
    <>
      <SEO title="Server Error \u2014 Lingua" noIndex />
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          {/* Polished orb icon */}
          <div className="relative mx-auto mb-8 size-28">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent blur-xl" />
            <div className="relative size-28 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
              <span className="text-4xl font-bold text-muted-foreground/40">500</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
            We hit an unexpected error on our end. Please try again in a moment.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-6"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="size-4 mr-1.5" />
              Retry
            </Button>
            <Button size="lg" className="rounded-full px-6" asChild>
              <Link href="/dashboard">
                <Home className="size-4 mr-1.5" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
