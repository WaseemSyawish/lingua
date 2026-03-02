import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { toast } from "sonner";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return;

    const sendBrowserNotification = (title: string, body: string) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification(title, { body, icon: "/favicon.svg" });
      } catch {}
    };

    const checkReminderNudges = async () => {
      try {
        const raw = localStorage.getItem("lingua-notifications");
        if (!raw) return;
        const prefs = JSON.parse(raw);

        const now = new Date();
        const hour = now.getHours();
        const dateKey = now.toISOString().slice(0, 10);

        if (prefs.dailyReminder && hour >= 14) {
          const dailyKey = localStorage.getItem("lingua-last-daily-reminder");
          if (dailyKey !== dateKey) {
            toast.info("Time for your daily practice session ✨", {
              description: "A quick chat today keeps your momentum strong.",
            });
            sendBrowserNotification("Lingua Daily Reminder", "Time for a quick language practice session ✨");
            localStorage.setItem("lingua-last-daily-reminder", dateKey);
          }
        }

        if (prefs.streakReminder && hour >= 20) {
          const streakKey = localStorage.getItem("lingua-last-streak-reminder");
          if (streakKey === dateKey) return;

          const progressRes = await fetch("/api/progress");
          if (!progressRes.ok) return;
          const progress = await progressRes.json();
          const sessions = progress?.recentSessions ?? [];
          const hasSessionToday = sessions.some((entry: { startedAt?: string }) => {
            if (!entry.startedAt) return false;
            const started = new Date(entry.startedAt).toISOString().slice(0, 10);
            return started === dateKey;
          });

          if (!hasSessionToday && (progress?.stats?.currentStreak ?? 0) > 0) {
            toast.warning("Streak alert 🔥", {
              description: "One quick session today keeps your streak alive.",
            });
            sendBrowserNotification("Lingua Streak Alert", "Complete one quick session to keep your streak alive 🔥");
            localStorage.setItem("lingua-last-streak-reminder", dateKey);
          }
        }
      } catch {}
    };

    const initialDelay = window.setTimeout(() => {
      checkReminderNudges();
    }, 1800);
    const interval = window.setInterval(checkReminderNudges, 30 * 60 * 1000);
    const onFocus = () => checkReminderNudges();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearTimeout(initialDelay);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [session?.user]);

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <ErrorBoundary>
          <TooltipProvider delayDuration={300}>
            <Component {...pageProps} />
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SessionProvider>
  );
}
