import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Card({ children, className, padding = "md" }: CardProps) {
  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-border shadow-sm",
        "dark:bg-surface-dark-secondary dark:border-border-dark",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
