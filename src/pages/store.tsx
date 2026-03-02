import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Coins,
  ShoppingBag,
  Zap,
  Lock,
  Check,
  Sparkles,
  ArrowLeft,
  Snowflake,
  Search,
  Lightbulb,
  TrendingUp,
  BookOpen,
  ShieldCheck,
  Brush,
  Moon,
  Leaf,
  Crown,
  Gem,
  Tag,
  BadgeCheck,
  Award,
  Timer,
  Smile,
  MessageSquare,
  Target,
  BarChart3,
  RotateCcw,
  Bookmark,
  Palette,
  Star,
  Trophy,
  Flame,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { StoreCategory, StoreItem } from "@/lib/store-constants";
import { STORE_CATEGORIES } from "@/lib/store-constants";
import { startStoreCozyAmbience } from "@/lib/audio";

// Map of Lucide icon name strings to their components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Snowflake, Search, Lightbulb, TrendingUp, BookOpen, ShieldCheck,
  Sparkles, Brush, Moon, Leaf, Crown, Gem, Tag, BadgeCheck, Award,
  Timer, Smile, MessageSquare, Target, BarChart3, RotateCcw, Bookmark,
  Palette, Star,
};

interface EnrichedItem extends StoreItem {
  owned: boolean;
  purchaseCount: number;
  canAfford: boolean;
  levelLocked: boolean;
}

interface StoreData {
  coins: number;
  level: number;
  items: EnrichedItem[];
  recentPurchases: { itemId: string; cost: number; date: string }[];
}

function StoreSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-10 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  index,
  onSelect,
}: {
  item: EnrichedItem;
  index: number;
  onSelect: () => void;
}) {
  const isLocked = item.levelLocked;
  const isOwned = item.owned;
  const cantAfford = !item.canAfford && !isOwned;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.3 }}
    >
      <button
        onClick={onSelect}
        disabled={isLocked}
        className={`w-full text-left rounded-xl overflow-hidden transition-all duration-200 group relative ${
          isLocked
            ? "opacity-40 cursor-not-allowed"
            : isOwned
              ? "ring-2 ring-green-500/30 shadow-lg shadow-green-500/10"
              : cantAfford
                ? "opacity-70 ring-1 ring-border/40"
                : "ring-1 ring-border/40 hover:ring-primary/40 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        <div
          className={`p-4 relative ${
            isOwned
              ? "bg-gradient-to-br from-green-500/8 to-emerald-500/5"
              : item.category === "boosts"
                ? "bg-gradient-to-br from-yellow-500/8 to-orange-500/5"
                : item.category === "cosmetics"
                  ? "bg-gradient-to-br from-violet-500/8 to-pink-500/5"
                  : "bg-gradient-to-br from-blue-500/8 to-cyan-500/5"
          }`}
        >
          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] z-10">
              <div className="flex flex-col items-center gap-1">
                <Lock className="size-5 text-muted-foreground" />
                <span className="text-[9px] font-bold text-muted-foreground">
                  Level {item.levelRequired}
                </span>
              </div>
            </div>
          )}

          {/* Owned badge */}
          {isOwned && (
            <div className="absolute top-2 right-2 size-6 rounded-full bg-green-500 flex items-center justify-center shadow-md z-10">
              <Check className="size-3.5 text-white" />
            </div>
          )}

          {/* Icon */}
          {(() => {
            const IconComp = ICON_MAP[item.icon] ?? ShoppingBag;
            const iconBg =
              item.category === "boosts"
                ? "from-yellow-500/20 to-amber-500/10"
                : item.category === "cosmetics"
                  ? "from-violet-500/20 to-pink-500/10"
                  : "from-blue-500/20 to-cyan-500/10";
            const iconColor =
              item.category === "boosts"
                ? "text-amber-500"
                : item.category === "cosmetics"
                  ? "text-violet-500"
                  : "text-blue-500";
            return (
              <div className={`size-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center mb-3 ring-1 ring-border/20`}>
                <IconComp className={`size-6 ${iconColor}`} />
              </div>
            );
          })()}

          {/* Name */}
          <p className="text-sm font-bold leading-tight mb-1">{item.name}</p>
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mb-3">
            {item.description}
          </p>

          {/* Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Coins className="size-3.5 text-yellow-500" />
              <span
                className={`text-sm font-black ${
                  isOwned
                    ? "text-green-500"
                    : cantAfford
                      ? "text-red-400"
                      : "text-yellow-600 dark:text-yellow-400"
                }`}
              >
                {isOwned ? "Owned" : item.cost}
              </span>
            </div>
            {item.levelRequired > 1 && !isLocked && (
              <span className="text-[9px] text-muted-foreground font-medium">
                L{item.levelRequired}+
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export default function StorePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<EnrichedItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [cozyAudioEnabled, setCozyAudioEnabled] = useState(false);
  const stopAmbientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/store")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      try {
        const stored = localStorage.getItem("lingua-store-cozy-audio");
        setCozyAudioEnabled(stored === "1");
      } catch {}
    }
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;

    if (cozyAudioEnabled) {
      stopAmbientRef.current = startStoreCozyAmbience();
    } else {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
    }

    try {
      localStorage.setItem("lingua-store-cozy-audio", cozyAudioEnabled ? "1" : "0");
    } catch {}

    return () => {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
    };
  }, [cozyAudioEnabled, session?.user]);

  const handlePurchase = async (itemId: string) => {
    setPurchasing(true);
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Purchase failed");
        return;
      }

      toast.success("Purchase complete!", { description: `You bought ${selectedItem?.name}` });

      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coins: result.coins,
          items: prev.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  owned: item.oneTime ? true : item.owned,
                  purchaseCount: item.purchaseCount + 1,
                  canAfford: result.coins >= item.cost,
                }
              : { ...item, canAfford: result.coins >= item.cost }
          ),
        };
      });
      setSelectedItem(null);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPurchasing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="Store — Lingua" />
        <StoreSkeleton />
      </Layout>
    );
  }
  if (!session) return null;

  const coins = data?.coins ?? 0;
  const items = data?.items ?? [];

  const getItemsForCategory = (cat: StoreCategory) =>
    items
      .filter((i) => i.category === cat)
      .sort((a, b) => {
        if (a.levelLocked !== b.levelLocked) return a.levelLocked ? 1 : -1;
        if (a.owned !== b.owned) return a.owned ? 1 : -1;
        return a.cost - b.cost;
      });

  return (
    <Layout>
      <SEO title="Store — Lingua" />
      <div className="space-y-5">
        {/* Header + Coin Balance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="relative bg-gradient-to-br from-yellow-600 via-amber-700 to-orange-800 dark:from-yellow-700 dark:via-amber-800 dark:to-orange-900">
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg, transparent, transparent 12px, rgba(255,255,255,0.1) 12px, rgba(255,255,255,0.1) 13px)",
                }}
              />
              <div className="absolute top-0 right-0 size-48 bg-yellow-400/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-0 size-32 bg-orange-400/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
              <CardContent className="relative p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="size-6 text-yellow-200" />
                      <h1 className="text-2xl sm:text-3xl font-black text-white">
                        Store
                      </h1>
                    </div>
                    <p className="text-sm text-yellow-100/70">
                      Spend coins on boosts, cosmetics, and perks
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCozyAudioEnabled((prev) => !prev)}
                      className="mt-3 h-8 text-[11px] gap-1.5 bg-white/15 hover:bg-white/20 text-white border border-white/20"
                    >
                      {cozyAudioEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                      {cozyAudioEnabled ? "Cozy music on" : "Cozy music off"}
                    </Button>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 border border-white/15">
                      <Coins className="size-5 sm:size-6 text-yellow-300" />
                      <span className="text-2xl sm:text-3xl font-black text-white">
                        {coins}
                      </span>
                    </div>
                    <p className="text-[10px] text-yellow-200/60 mt-1.5 font-medium">
                      Earn coins from sessions & leveling up
                    </p>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* How to earn coins */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <Card className="border-yellow-500/10 bg-gradient-to-r from-yellow-500/3 to-amber-500/8">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="size-3.5 text-yellow-500" />
                <span className="text-xs font-bold">How to Earn Coins</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Session", amount: "+15", icon: BookOpen },
                  { label: "Level Up", amount: "+100", icon: TrendingUp },
                  { label: "Achievement", amount: "+30", icon: Trophy },
                  { label: "7-day Streak", amount: "+50", icon: Flame },
                ].map((r) => {
                  const RIcon = r.icon;
                  return (
                    <div
                      key={r.label}
                      className="flex items-center gap-2 bg-background/60 rounded-lg px-2.5 py-1.5 border border-border/30"
                    >
                      <div className="size-7 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                        <RIcon className="size-3.5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {r.label}
                        </p>
                        <p className="text-xs font-black text-yellow-600 dark:text-yellow-400">
                          {r.amount}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Store Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Tabs defaultValue="boosts" className="w-full">
            <TabsList className="w-full mb-3">
              {STORE_CATEGORIES.map((cat) => {
                const CatIcon = ICON_MAP[cat.icon] ?? ShoppingBag;
                return (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="flex-1 text-xs gap-1.5"
                  >
                    <CatIcon className="size-3" />
                    {cat.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {STORE_CATEGORIES.map((cat) => (
              <TabsContent key={cat.id} value={cat.id}>
                <p className="text-xs text-muted-foreground mb-3">
                  {cat.desc}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {getItemsForCategory(cat.id).map((item, i) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      index={i}
                      onSelect={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
                {getItemsForCategory(cat.id).length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <ShoppingBag className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium">No items yet</p>
                      <p className="text-xs text-muted-foreground">
                        More items coming soon!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>

        {/* Back to profile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => router.push("/profile")}
          >
            <ArrowLeft className="size-4" />
            Back to Profile
          </Button>
        </motion.div>

        {/* Purchase Dialog */}
        <Dialog
          open={!!selectedItem}
          onOpenChange={() => setSelectedItem(null)}
        >
          <DialogContent className="max-w-sm">
            {selectedItem && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {(() => {
                      const DlgIcon = ICON_MAP[selectedItem.icon] ?? ShoppingBag;
                      const dlgBg =
                        selectedItem.category === "boosts"
                          ? "from-yellow-500/20 to-amber-500/10"
                          : selectedItem.category === "cosmetics"
                            ? "from-violet-500/20 to-pink-500/10"
                            : "from-blue-500/20 to-cyan-500/10";
                      const dlgColor =
                        selectedItem.category === "boosts"
                          ? "text-amber-500"
                          : selectedItem.category === "cosmetics"
                            ? "text-violet-500"
                            : "text-blue-500";
                      return (
                        <div className={`size-11 rounded-xl bg-gradient-to-br ${dlgBg} flex items-center justify-center shrink-0 ring-1 ring-border/20`}>
                          <DlgIcon className={`size-6 ${dlgColor}`} />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="text-lg font-bold">{selectedItem.name}</p>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {selectedItem.category}
                      </Badge>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.description}
                  </p>

                  {selectedItem.levelLocked ? (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-center">
                      <Lock className="size-5 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium">Level Locked</p>
                      <p className="text-xs text-muted-foreground">
                        Reach level {selectedItem.levelRequired} to unlock
                      </p>
                    </div>
                  ) : selectedItem.owned ? (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <Check className="size-5 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">
                        Already Owned
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30">
                        <span className="text-sm font-medium">Cost</span>
                        <div className="flex items-center gap-1.5">
                          <Coins className="size-4 text-yellow-500" />
                          <span className="text-lg font-black">
                            {selectedItem.cost}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Your balance</span>
                        <span
                          className={`font-bold ${
                            coins >= selectedItem.cost
                              ? "text-green-500"
                              : "text-red-400"
                          }`}
                        >
                          {coins} coins
                        </span>
                      </div>
                      {coins < selectedItem.cost && (
                        <p className="text-xs text-red-400 text-center">
                          You need {selectedItem.cost - coins} more coins
                        </p>
                      )}
                      <Button
                        className="w-full gap-2"
                        disabled={
                          !selectedItem.canAfford || purchasing
                        }
                        onClick={() => handlePurchase(selectedItem.id)}
                      >
                        {purchasing ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="size-4 border-2 border-current/30 border-t-current rounded-full"
                            />
                            Purchasing...
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="size-4" />
                            Buy for {selectedItem.cost} coins
                          </>
                        )}
                      </Button>
                    </>
                  )}

                  {selectedItem.levelRequired > 1 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Requires Level {selectedItem.levelRequired}
                    </p>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
