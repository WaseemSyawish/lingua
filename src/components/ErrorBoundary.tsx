import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
          <div className="max-w-md mx-auto">
            {/* Animated gradient orb */}
            <div className="relative mx-auto mb-8 size-28">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-xl" />
              <div className="relative size-28 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground/60"
                >
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M3.6 15.4A8.97 8.97 0 0 1 3 12a9 9 0 0 1 18 0 8.97 8.97 0 0 1-.6 3.4" />
                  <path d="m2 16 2 2 2-2" />
                  <path d="m18 16 2 2 2-2" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
              We hit an unexpected snag. This has been noted and we&apos;re looking into it.
            </p>
            {process.env.NODE_ENV === "development" && this.state.error?.message && (
              <div className="mb-6 p-3 rounded-lg bg-muted/50 border border-border/50 text-left">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try Again
              </Button>
              <Button
                size="lg"
                className="rounded-full px-6"
                onClick={() => (window.location.href = "/")}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
