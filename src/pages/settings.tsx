import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signOut } from "next-auth/react";
import { motion } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import { cefrLabel } from "@/lib/utils";
import ReactCountryFlag from "react-country-flag";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Settings,
  User,
  Globe,
  Shield,
  Trash2,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Languages,
  Clock,
  Target,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Chrome,
  Link2,
  Unlink,
  Zap,
  Star,
  ChevronRight,
} from "lucide-react";

interface UserProfile {
  name: string | null;
  email: string;
  nativeLanguage: string | null;
  targetLanguage: string;
  currentCEFRLevel: string;
  placementCompleted: boolean;
  createdAt: string;
  hasPassword: boolean;
  connectedAccounts: { provider: string; type: string }[];
  xp: number;
  xpLevel: number;
}

const LANGUAGES = [
  { code: "fr", label: "French", countryCode: "FR" },
  { code: "es", label: "Spanish", countryCode: "ES" },
  { code: "de", label: "German", countryCode: "DE" },
];

const NATIVE_LANGUAGES = [
  { code: "en", label: "English", countryCode: "GB" },
  { code: "fr", label: "French", countryCode: "FR" },
  { code: "es", label: "Spanish", countryCode: "ES" },
  { code: "de", label: "German", countryCode: "DE" },
  { code: "pt", label: "Portuguese", countryCode: "BR" },
  { code: "it", label: "Italian", countryCode: "IT" },
  { code: "zh", label: "Chinese", countryCode: "CN" },
  { code: "ja", label: "Japanese", countryCode: "JP" },
  { code: "ko", label: "Korean", countryCode: "KR" },
  { code: "ar", label: "Arabic", countryCode: "SA" },
  { code: "hi", label: "Hindi", countryCode: "IN" },
  { code: "ru", label: "Russian", countryCode: "RU" },
  { code: "tr", label: "Turkish", countryCode: "TR" },
  { code: "nl", label: "Dutch", countryCode: "NL" },
  { code: "pl", label: "Polish", countryCode: "PL" },
  { code: "sv", label: "Swedish", countryCode: "SE" },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("en");

  // Preferences (localStorage)
  const [sessionLength, setSessionLength] = useState("standard");
  const [dailyGoal, setDailyGoal] = useState("1");
  const [translationHints, setTranslationHints] = useState(true);
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);

  // Notifications (localStorage)
  const [dailyReminder, setDailyReminder] = useState(false);
  const [streakReminder, setStreakReminder] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Security — password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const prefs = localStorage.getItem("lingua-preferences");
      if (prefs) {
        const p = JSON.parse(prefs);
        if (p.sessionLength) setSessionLength(p.sessionLength);
        if (p.dailyGoal) setDailyGoal(p.dailyGoal);
        if (p.translationHints !== undefined) setTranslationHints(p.translationHints);
        if (p.autoPlayVoice !== undefined) setAutoPlayVoice(p.autoPlayVoice);
      }
      const notifs = localStorage.getItem("lingua-notifications");
      if (notifs) {
        const n = JSON.parse(notifs);
        if (n.dailyReminder !== undefined) setDailyReminder(n.dailyReminder);
        if (n.streakReminder !== undefined) setStreakReminder(n.streakReminder);
        if (n.soundEnabled !== undefined) setSoundEnabled(n.soundEnabled);
      }
    } catch {}
    setPrefsLoaded(true);
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem("lingua-preferences", JSON.stringify({
        sessionLength, dailyGoal, translationHints, autoPlayVoice,
      }));
    } catch {}
  }, [sessionLength, dailyGoal, translationHints, autoPlayVoice, prefsLoaded]);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem("lingua-notifications", JSON.stringify({
        dailyReminder, streakReminder, soundEnabled,
      }));
    } catch {}
  }, [dailyReminder, streakReminder, soundEnabled, prefsLoaded]);

  async function handleDailyReminderToggle() {
    const next = !dailyReminder;
    setDailyReminder(next);

    if (!next) {
      toast.success("Daily reminder turned off");
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      } catch {}
    }

    toast.success("Daily reminder turned on");
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
    if (session?.user) fetchProfile();
  }, [status, session, router]);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setName(data.user.name || "");
        setTargetLanguage(data.user.targetLanguage);
        setNativeLanguage(data.user.nativeLanguage || "en");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetLanguage, nativeLanguage }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => prev ? { ...prev, ...data.user } : prev);
        toast.success("Settings saved");
        await updateSession();
      } else {
        const err = await res.json();
        toast.error(err.error || "Save failed");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (!newPassword || !currentPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Password change failed");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleCreatePassword() {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        toast.success("Password created! You can now sign in with your email too.");
        setNewPassword("");
        setConfirmPassword("");
        setProfile((prev) => prev ? { ...prev, hasPassword: true } : prev);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create password");
      }
    } catch {
      toast.error("Failed to create password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      if (res.ok) {
        toast.success("Account deleted");
        signOut({ callbackUrl: "/" });
      } else {
        toast.error("Failed to delete account");
      }
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  const hasChanges = profile && (
    name !== (profile.name || "") ||
    targetLanguage !== profile.targetLanguage ||
    nativeLanguage !== (profile.nativeLanguage || "en")
  );

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="Settings" />
        <div className="space-y-4 max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  const tutor = getTutorConfig(targetLanguage || "fr");
  const isOAuthOnly = profile ? !profile.hasPassword && profile.connectedAccounts.length > 0 : false;
  const googleAccount = profile?.connectedAccounts.find((a) => a.provider === "google");

  return (
    <Layout>
      <SEO title="Settings — Lingua" />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
        </motion.div>

        {/* ─── ACCOUNT (moved to top) ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                <CardTitle className="text-base">Account</CardTitle>
              </div>
              <CardDescription>Your account details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium truncate">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">CEFR Level</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-bold text-xs">
                      {profile?.currentCEFRLevel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {cefrLabel(profile?.currentCEFRLevel || "A0")}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">XP Level</p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold gap-1">
                      <Zap className="size-3" />
                      Level {profile?.xpLevel || 1}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{profile?.xp || 0} XP</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Member Since</p>
                  <p className="text-sm font-medium">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
              {profile?.placementCompleted && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle2 className="size-3.5" />
                  Placement assessment completed
                </div>
              )}
              <p className="text-[10px] text-muted-foreground italic">
                App language: English only. More languages coming in future updates.
              </p>
              {/* Change Password quick-access */}
              {!isOAuthOnly && profile?.hasPassword && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Password & security settings</span>
                  </div>
                  <button
                    onClick={() => document.getElementById("security")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    Change Password <ChevronRight className="size-3" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── PROFILE ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                <CardTitle className="text-base">Profile</CardTitle>
              </div>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label>Native Language</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NATIVE_LANGUAGES.slice(0, 8).map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setNativeLanguage(lang.code)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                        nativeLanguage === lang.code
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ReactCountryFlag countryCode={lang.countryCode} svg style={{ width: "1rem", height: "1rem" }} className="rounded-sm" />
                      <span className="truncate">{lang.label}</span>
                    </button>
                  ))}
                </div>
                {!NATIVE_LANGUAGES.slice(0, 8).find((l) => l.code === nativeLanguage) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {NATIVE_LANGUAGES.slice(8).map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setNativeLanguage(lang.code)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                          nativeLanguage === lang.code
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ReactCountryFlag countryCode={lang.countryCode} svg style={{ width: "1rem", height: "1rem" }} className="rounded-sm" />
                        <span className="truncate">{lang.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── LEARNING LANGUAGE ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Languages className="size-4 text-primary" />
                <CardTitle className="text-base">Learning Language</CardTitle>
              </div>
              <CardDescription>This is the language your tutor speaks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {LANGUAGES.map((lang) => {
                  const isActive = targetLanguage === lang.code;
                  const langTutor = getTutorConfig(lang.code);
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLanguage(lang.code)}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="size-4 text-primary" />
                        </div>
                      )}
                      <ReactCountryFlag
                        countryCode={lang.countryCode}
                        svg
                        style={{ width: "2rem", height: "2rem" }}
                        className="rounded"
                      />
                      <span className="font-semibold text-sm">{lang.label}</span>
                      <span className="text-[10px] text-muted-foreground">with {langTutor.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── PREFERENCES ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <CardTitle className="text-base">Preferences</CardTitle>
              </div>
              <CardDescription>Customize your learning experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Session Length */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <Label className="text-sm">Default Session Length</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "quick", label: "Quick", desc: "~10 min" },
                    { value: "standard", label: "Standard", desc: "~15 min" },
                    { value: "deep", label: "Deep", desc: "~20 min" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSessionLength(opt.value)}
                      className={`flex flex-col items-center gap-0.5 p-3 rounded-lg border transition-all ${
                        sessionLength === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Daily Goal */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="size-3.5 text-muted-foreground" />
                  <Label className="text-sm">Daily Goal</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "1", label: "Casual", desc: "1 session/day" },
                    { value: "2", label: "Steady", desc: "2 sessions/day" },
                    { value: "3", label: "Intense", desc: "3 sessions/day" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDailyGoal(opt.value)}
                      className={`flex flex-col items-center gap-0.5 p-3 rounded-lg border transition-all ${
                        dailyGoal === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px]">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Toggle Preferences */}
              <div className="space-y-3">
                <button
                  onClick={() => setTranslationHints(!translationHints)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg flex items-center justify-center ${translationHints ? "bg-primary/10" : "bg-muted/50"}`}>
                      <Globe className={`size-4 ${translationHints ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Translation Hints</p>
                      <p className="text-[10px] text-muted-foreground">Show native language hints in messages</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors ${translationHints ? "bg-primary" : "bg-muted"} flex items-center`}>
                    <div className={`size-4 rounded-full bg-white shadow-sm transition-transform ${translationHints ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                </button>
                <button
                  onClick={() => setAutoPlayVoice(!autoPlayVoice)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg flex items-center justify-center ${autoPlayVoice ? "bg-primary/10" : "bg-muted/50"}`}>
                      {autoPlayVoice ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Auto-play Voice</p>
                      <p className="text-[10px] text-muted-foreground">Read tutor responses aloud automatically</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors ${autoPlayVoice ? "bg-primary" : "bg-muted"} flex items-center`}>
                    <div className={`size-4 rounded-full bg-white shadow-sm transition-transform ${autoPlayVoice ? "translate-x-5" : "translate-x-1"}`} />
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── SECURITY ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
          <Card id="security">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                <CardTitle className="text-base">Security</CardTitle>
              </div>
              <CardDescription>Password and connected accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Password Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">Password</p>
                  {isOAuthOnly && !profile?.hasPassword && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                      Adds email sign-in
                    </span>
                  )}
                </div>
                {profile?.hasPassword ? (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/20 border">
                    <div className="space-y-1.5">
                      <Label htmlFor="currentPw" className="text-xs">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPw"
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newPw" className="text-xs">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPw"
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPw" className="text-xs">Confirm New Password</Label>
                      <Input
                        id="confirmPw"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Passwords don&apos;t match
                      </p>
                    )}
                    <Button
                      size="sm"
                      disabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || changingPassword}
                      onClick={handlePasswordChange}
                      className="gap-1.5"
                    >
                      {changingPassword ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                      Change Password
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 rounded-lg bg-muted/20 border">
                    {isOAuthOnly && (
                      <p className="text-[11px] text-muted-foreground bg-blue-500/5 rounded-lg p-2.5 border border-blue-500/10 leading-relaxed">
                        Creating a password lets you sign in with your email as an alternative to Google — handy if Google keeps sending 2FA prompts.
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="newPwCreate" className="text-xs">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPwCreate"
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPwCreate" className="text-xs">Confirm Password</Label>
                      <Input
                        id="confirmPwCreate"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-destructive flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Passwords don&apos;t match
                      </p>
                    )}
                    <Button
                      size="sm"
                      disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 8 || changingPassword}
                      onClick={handleCreatePassword}
                      className="gap-1.5"
                    >
                      {changingPassword ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                      {isOAuthOnly ? "Create Password" : "Set Password"}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Connected Accounts */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Link2 className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">Connected Accounts</p>
                </div>
                {profile?.connectedAccounts && profile.connectedAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {profile.connectedAccounts.map((acc) => (
                      <div key={acc.provider} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden">
                            {acc.provider === "google" ? (
                              <GoogleIcon className="size-4" />
                            ) : (
                              <Globe className="size-4 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium capitalize">{acc.provider}</p>
                            <p className="text-[10px] text-muted-foreground">Connected via {acc.type}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <CheckCircle2 className="size-2.5" />
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No external accounts connected. Using email/password login.</p>
                )}
              </div>

              <Separator />

              {/* Active Sessions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">Active Sessions</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Smartphone className="size-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Current Device</p>
                      <p className="text-[10px] text-muted-foreground">
                        {typeof navigator !== "undefined" ? navigator.userAgent.split(" ").slice(-2).join(" ").substring(0, 40) : "Browser"} · Active now
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                    Current
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => { signOut({ callbackUrl: "/auth/signin" }); }}
                >
                  <LogOut className="size-3" />
                  Sign Out All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── NOTIFICATIONS ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <CardTitle className="text-base">Notifications</CardTitle>
              </div>
              <CardDescription>Manage your notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={handleDailyReminderToggle}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-lg flex items-center justify-center ${dailyReminder ? "bg-primary/10" : "bg-muted/50"}`}>
                    {dailyReminder ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Daily Reminder</p>
                    <p className="text-[10px] text-muted-foreground">Get a nudge to practice every day</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${dailyReminder ? "bg-primary" : "bg-muted"} flex items-center`}>
                  <div className={`size-4 rounded-full bg-white shadow-sm transition-transform ${dailyReminder ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>
              <button
                onClick={() => setStreakReminder(!streakReminder)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-lg flex items-center justify-center ${streakReminder ? "bg-orange-500/10" : "bg-muted/50"}`}>
                    <Star className={`size-4 ${streakReminder ? "text-orange-500" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Streak Alert</p>
                    <p className="text-[10px] text-muted-foreground">Remind me before I lose my streak</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${streakReminder ? "bg-orange-500" : "bg-muted"} flex items-center`}>
                  <div className={`size-4 rounded-full bg-white shadow-sm transition-transform ${streakReminder ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-lg flex items-center justify-center ${soundEnabled ? "bg-violet-500/10" : "bg-muted/50"}`}>
                    {soundEnabled ? <Volume2 className="size-4 text-violet-500" /> : <VolumeX className="size-4 text-muted-foreground" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Notification Sounds</p>
                    <p className="text-[10px] text-muted-foreground">Play a soft chime for in-app alerts</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${soundEnabled ? "bg-violet-500" : "bg-muted"} flex items-center`}>
                  <div className={`size-4 rounded-full bg-white shadow-sm transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-1"}`} />
                </div>
              </button>
              <p className="text-[10px] text-muted-foreground italic">
                Browser notifications require permission. Preferences are stored locally.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── SAVE & SIGN OUT ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
          <div className="flex items-center gap-3">
            <Button
              className="flex-1 gap-2"
              disabled={!hasChanges || saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* ─── DANGER ZONE ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" size="sm">
                    <Trash2 className="size-4" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-destructive" />
                      Delete Account
                    </DialogTitle>
                    <DialogDescription>
                      This will permanently delete your account & all learning data.
                      This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleting}
                      onClick={handleDeleteAccount}
                      className="gap-2"
                    >
                      {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      {deleting ? "Deleting..." : "Yes, Delete Everything"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <p className="text-[10px] text-muted-foreground mt-2">
                Once deleted, all your sessions, progress, and achievements are gone forever.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
