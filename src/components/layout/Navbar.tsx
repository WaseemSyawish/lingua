import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/ThemeProvider";
import {
  LayoutDashboard,
  MessageCircle,
  BarChart3,
  History,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  User,
  Flame,
  Zap,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice", label: "Practice", icon: MessageCircle },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/history", label: "History", icon: History },
];

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [streak, setStreak] = useState<number>(0);
  const [xpLevel, setXpLevel] = useState<number>(0);
  const [xpPercent, setXpPercent] = useState<number>(0);

  // Fetch streak + XP data when logged in
  useEffect(() => {
    if (session?.user) {
      Promise.all([
        fetch("/api/progress").then((r) => r.ok ? r.json() : null),
        fetch("/api/xp").then((r) => r.ok ? r.json() : null),
      ]).then(([progressData, xpData]) => {
        if (progressData?.stats?.currentStreak != null) {
          setStreak(progressData.stats.currentStreak);
        }
        if (xpData) {
          setXpLevel(xpData.level || 0);
          setXpPercent(xpData.progress?.percent || 0);
        }
      }).catch(() => {});
    }
  }, [session]);

  // Streak visual tier classes
  const streakDisplay = streak > 0 ? (
    <div className={cn(
      "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold transition-all",
      streak >= 7
        ? "bg-gradient-to-r from-orange-500/20 to-red-500/15 text-orange-500 ring-1 ring-orange-500/30 shadow-sm shadow-orange-500/20"
        : streak >= 3
          ? "bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/20"
          : "bg-muted/50 text-muted-foreground"
    )}>
      <Flame className={cn(
        "size-3.5",
        streak >= 7 ? "text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.6)]" :
        streak >= 3 ? "text-orange-500" : "text-muted-foreground"
      )} />
      <span>{streak}</span>
    </div>
  ) : null;

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href={session ? "/dashboard" : "/"}
            className="flex items-center gap-2"
          >
            <span className="text-xl font-bold text-primary">Lingua</span>
          </Link>

          {/* Desktop Nav */}
          {session && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active =
                  router.pathname === link.href ||
                  router.pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {session ? (
              <>
                {/* Streak display */}
                {streakDisplay}

                {/* Theme toggle */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      <span className="sr-only">Toggle theme</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun className="size-4 mr-2" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon className="size-4 mr-2" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Monitor className="size-4 mr-2" /> System
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="gap-2 px-2 h-auto py-1.5"
                    >
                      <div className="relative">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {session.user?.name?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        {xpLevel > 0 && (
                          <div className="absolute -bottom-1.5 -right-1.5 px-1 py-0.5 rounded-full bg-primary text-[8px] font-black text-primary-foreground ring-2 ring-background leading-none min-w-[18px] text-center">
                            {xpLevel}
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:flex flex-col items-start gap-0.5">
                        <span className="text-sm font-medium leading-none">
                          {session.user?.name}
                        </span>
                        {xpLevel > 0 && (
                          <div className="flex items-center gap-1">
                            <Zap className="size-2.5 text-yellow-500" />
                            <div className="w-16 h-1.5 bg-primary/15 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">L{xpLevel}</span>
                          </div>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/profile")}>
                      <User className="size-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/store")}>
                      <ShoppingBag className="size-4 mr-2" />
                      Store
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      <Settings className="size-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      <LogOut className="size-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/signin">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/signup">Get started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
