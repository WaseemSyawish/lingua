import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "motion/react";
import SEO from "@/components/SEO";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  MessageCircle,
  Brain,
  BarChart3,
} from "lucide-react";
import { LinguaLogo } from "@/components/LinguaLogo";

const benefits = [
  { icon: <MessageCircle className="size-4" />, text: "Unlimited conversations with your AI tutor" },
  { icon: <Brain className="size-4" />, text: "AI that adapts to your level" },
  { icon: <BarChart3 className="size-4" />, text: "Track your progress in real time" },
];

export default function SignUpPage() {
  const router = useRouter();
  const callbackUrl =
    typeof router.query.callbackUrl === "string"
      ? router.query.callbackUrl
      : "/onboarding";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { forceDark } = useTheme();

  // Always render auth pages in dark mode
  useEffect(() => {
    return forceDark();
  }, [forceDark]);

  // Display OAuth errors passed back via query string (e.g. ?error=OAuthSignin)
  useEffect(() => {
    if (router.query.error) {
      const oauthErrors: Record<string, string> = {
        OAuthSignin: "Failed to start Google sign-in. Check that Google OAuth is configured correctly.",
        OAuthCallback: "Google sign-in callback failed. Please try again.",
        OAuthCreateAccount: "Could not create account with Google. Please try again.",
        OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
        Callback: "OAuth callback error. Please try again.",
      };
      const errorKey = router.query.error as string;
      setError(oauthErrors[errorKey] ?? `Sign-in error: ${errorKey}`);
    }
  }, [router.query.error]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        identifier: email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        window.location.assign(result?.url || callbackUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <SEO title="Sign Up" />

      {/* Back to landing */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 size-10 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
      >
        <ArrowLeft className="size-4" />
      </Link>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 size-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-1/4 size-48 bg-primary/5 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-md"
        >
          <div className="size-16 rounded-2xl bg-primary flex items-center justify-center mb-8">
            <LinguaLogo className="size-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Start your language journey today
          </h2>
          <p className="text-muted-foreground text-lg mb-10">
            Join thousands of learners who are mastering a new language through natural AI-powered conversations.
          </p>
          <div className="space-y-4">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                className="flex items-center gap-3 text-sm"
              >
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  {b.icon}
                </div>
                <span className="text-muted-foreground">{b.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center lg:hidden">
                <LinguaLogo className="size-4 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-primary">Lingua</span>
            </Link>
            <h1 className="text-2xl font-bold mb-1">Create account</h1>
            <p className="text-muted-foreground text-sm">
              Start learning a new language in minutes.
            </p>
          </div>

          <Card className="border-0 shadow-xl shadow-black/5 bg-card/80 backdrop-blur">
            <CardContent className="pt-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="h-11 rounded-xl"
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl text-sm font-medium" disabled={loading}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  or
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl text-sm"
                onClick={() => { setGoogleLoading(true); signIn("google", { callbackUrl }); }}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Redirecting...
                  </span>
                ) : (
                  <>
                    <svg className="size-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
