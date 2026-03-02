import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "./Navbar";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageCircle,
  BarChart3,
  History,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  hideBottomNav?: boolean;
}

const bottomNavLinks = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/practice", label: "Practice", icon: MessageCircle },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/history", label: "History", icon: History },
];

export default function Layout({
  children,
  showNav = true,
  maxWidth = "lg",
  hideBottomNav = false,
}: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const maxWidths = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {showNav && <Navbar />}
      <main
        id="main-content"
        role="main"
        className={`${maxWidths[maxWidth]} mx-auto px-4 sm:px-6 py-6 ${session && !hideBottomNav ? "pb-20 md:pb-6" : ""}`}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {session && !hideBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-lg border-t md:hidden safe-area-bottom">
          <div className="flex items-center justify-around h-14">
            {bottomNavLinks.map((link) => {
              const Icon = link.icon;
              const active =
                router.pathname === link.href ||
                router.pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-1 min-w-[3rem] transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-[10px] font-medium">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
