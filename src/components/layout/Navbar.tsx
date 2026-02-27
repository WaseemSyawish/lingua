import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/practice", label: "Practice" },
    { href: "/progress", label: "Progress" },
    { href: "/history", label: "History" },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-lg border-b border-border dark:bg-surface-dark/80 dark:border-border-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">Lingua</span>
          </Link>

          {/* Desktop nav */}
          {session && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    router.pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-slate-800"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {session ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm text-text-primary dark:text-text-dark-primary">
                    {session.user.name}
                  </span>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-48 bg-surface dark:bg-surface-dark-secondary border border-border dark:border-border-dark rounded-lg shadow-lg py-1">
                      <div className="px-3 py-2 border-b border-border dark:border-border-dark">
                        <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">
                          {session.user.email}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                          Level: {(session.user as any).cefrLevel || "A0"}
                        </p>
                      </div>

                      {/* Mobile nav links */}
                      <div className="md:hidden">
                        {navLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="block px-3 py-2 text-sm text-text-primary hover:bg-gray-100 dark:text-text-dark-primary dark:hover:bg-slate-800"
                            onClick={() => setMenuOpen(false)}
                          >
                            {link.label}
                          </Link>
                        ))}
                        <div className="border-t border-border dark:border-border-dark my-1" />
                      </div>

                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full text-left px-3 py-2 text-sm text-error hover:bg-gray-100 dark:hover:bg-slate-800"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="text-sm text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
