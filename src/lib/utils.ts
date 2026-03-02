import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { CEFRLevel } from "@/generated/prisma/enums";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CEFR_ORDER: CEFRLevel[] = [
  CEFRLevel.A0,
  CEFRLevel.A1,
  CEFRLevel.A2,
  CEFRLevel.B1,
  CEFRLevel.B2,
  CEFRLevel.C1,
  CEFRLevel.C2,
];

export function cefrToIndex(level: CEFRLevel): number {
  return CEFR_ORDER.indexOf(level);
}

export function cefrLabel(level: CEFRLevel | string): string {
  const labels: Record<string, string> = {
    A0: "Découverte",
    A1: "Fondations",
    A2: "En Route",
    B1: "Conversation",
    B2: "Aisance",
    C1: "Maîtrise",
    C2: "Excellence",
  };
  return labels[level] || level;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
