import { ReactNode } from "react";
import Navbar from "./Navbar";
import MobileNav from "./MobileNav";
import { useSession } from "next-auth/react";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

export default function Layout({ children, showNav = true, maxWidth = "lg" }: LayoutProps) {
  const { data: session } = useSession();

  const maxWidths = {
    sm: "max-w-2xl",
    md: "max-w-4xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {showNav && <Navbar />}
      <main
        id="main-content"
        role="main"
        className={`${maxWidths[maxWidth]} mx-auto px-4 sm:px-6 py-6 ${showNav && session ? "pb-20 md:pb-6" : ""}`}
      >
        {children}
      </main>
      {showNav && session && <MobileNav />}
    </div>
  );
}
