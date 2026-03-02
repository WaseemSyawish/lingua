import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "motion/react";
import ReactCountryFlag from "react-country-flag";
import SEO from "@/components/SEO";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Brain,
  BarChart3,
  BookOpen,
  Sparkles,
  Globe,
  ArrowRight,
  Star,
} from "lucide-react";
import { LinguaLogo } from "@/components/LinguaLogo";

/* ─── Mock conversations for each tutor ─── */
const tutorConversations: Record<string, { countryCode: string; name: string; subtitle: string; initial: string; messages: { role: "user" | "assistant"; text: string }[] }> = {
  fr: {
    countryCode: "FR",
    name: "Amélie",
    subtitle: "French Tutor",
    initial: "A",
    messages: [
      { role: "assistant", text: "Bonjour ! Je suis Amélie, ta tutrice de français. Comment tu t'appelles ?" },
      { role: "user", text: "Bonjour Amélie ! Je m'appelle Sarah." },
      { role: "assistant", text: "Enchantée Sarah ! Tu parles déjà bien. Qu'est-ce que tu aimes faire pendant ton temps libre ?" },
      { role: "user", text: "J'aime regarder les films français et cuisiner" },
      { role: "assistant", text: "Oh, les films français ! Et en cuisine, tu préfères les plats sucrés ou salés ? (sweet or savory?)" },
    ],
  },
  es: {
    countryCode: "ES",
    name: "Sofía",
    subtitle: "Spanish Tutor",
    initial: "S",
    messages: [
      { role: "assistant", text: "¡Hola! Soy Sofía, tu tutora de español. ¿Cómo te llamas?" },
      { role: "user", text: "¡Hola Sofía! Me llamo Alex." },
      { role: "assistant", text: "¡Encantada, Alex! Ya hablas bastante bien. ¿Qué te gusta hacer en tu tiempo libre?" },
      { role: "user", text: "Me gusta escuchar música y viajar" },
      { role: "assistant", text: "¡Qué bien! ¿Qué tipo de música te gusta? ¿Y cuál fue tu último viaje? (What was your last trip?)" },
    ],
  },
  de: {
    countryCode: "DE",
    name: "Hans",
    subtitle: "German Tutor",
    initial: "H",
    messages: [
      { role: "assistant", text: "Hallo! Ich bin Hans, dein Deutschlehrer. Wie heißt du?" },
      { role: "user", text: "Hallo Hans! Ich heiße Emma." },
      { role: "assistant", text: "Freut mich, Emma! Du sprichst schon gut. Was machst du gern in deiner Freizeit?" },
      { role: "user", text: "Ich lese gern Bücher und wandere." },
      { role: "assistant", text: "Toll! Welche Bücher liest du am liebsten? Und wo gehst du gern wandern? (Where do you like to hike?)" },
    ],
  },
};

const tutorTabs = Object.entries(tutorConversations).map(([code, t]) => ({
  code,
  countryCode: t.countryCode,
  name: t.name,
}));

function MockChat({ activeTutor }: { activeTutor: string }) {
  const data = tutorConversations[activeTutor] || tutorConversations.fr;
  const [visibleMessages, setVisibleMessages] = useState<number>(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingIndex, setTypingIndex] = useState<number>(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Reset animation when tutor changes
  useEffect(() => {
    setVisibleMessages(0);
    setIsTyping(false);
  }, [activeTutor]);

  // Loop: restart after a 3-second pause once all messages are shown
  useEffect(() => {
    if (visibleMessages < data.messages.length) return;
    const loopTimer = setTimeout(() => setVisibleMessages(0), 3000);
    return () => clearTimeout(loopTimer);
  }, [visibleMessages, data.messages.length]);

  useEffect(() => {
    if (visibleMessages >= data.messages.length) return;

    const nextMsg = data.messages[visibleMessages];
    const baseDelay = visibleMessages === 0 ? 600 : 900;

    const typingTimer = setTimeout(() => {
      setIsTyping(true);
      setTypingIndex(visibleMessages);
    }, baseDelay);

    const msgTimer = setTimeout(() => {
      setIsTyping(false);
      setVisibleMessages((v) => v + 1);
    }, baseDelay + 700 + (nextMsg.role === "assistant" ? 500 : 200));

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(msgTimer);
    };
  }, [visibleMessages, data.messages]);

  // Auto-scroll to bottom when messages or typing indicator changes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages, isTyping]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Phone frame */}
      <div className="relative bg-card border-2 border-border/60 rounded-3xl shadow-2xl shadow-primary/5 overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="text-[10px] text-muted-foreground font-medium">9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-muted-foreground/40 rounded-sm relative">
              <div className="absolute inset-[1px] right-[2px] bg-muted-foreground/40 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/80">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">{data.initial}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{data.name}</p>
              <ReactCountryFlag
                countryCode={data.countryCode}
                svg
                aria-label={data.countryCode}
                style={{ width: "0.9em", height: "0.9em", display: "inline-block", verticalAlign: "middle" }}
              />
            </div>
            <p className="text-[11px] text-emerald-500 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
              Online
            </p>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="p-4 space-y-3 h-[320px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <AnimatePresence mode="popLayout">
            {data.messages.slice(0, visibleMessages).map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                      : "bg-muted border rounded-2xl rounded-bl-md"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex ${data.messages[typingIndex]?.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    data.messages[typingIndex]?.role === "user"
                      ? "bg-primary/20 rounded-br-md"
                      : "bg-muted border rounded-bl-md"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 bg-muted/50 border rounded-full px-4 py-2.5">
            <span className="text-xs text-muted-foreground flex-1">Type a message...</span>
            <div className="size-7 rounded-full bg-primary flex items-center justify-center">
              <ArrowRight className="size-3.5 text-primary-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent elements */}
      <div className="absolute -top-3 -right-3 size-6 rounded-full bg-primary/20 blur-sm" />
      <div className="absolute -bottom-2 -left-2 size-4 rounded-full bg-primary/15 blur-sm" />
    </div>
  );
}

/* ─── Features ─── */
const features = [
  {
    icon: <MessageCircle className="size-5" />,
    title: "Natural Conversations",
    description:
      "Chat with your AI tutor in your target language — they adapt to your level automatically.",
  },
  {
    icon: <Brain className="size-5" />,
    title: "Adaptive Learning",
    description:
      "AI adjusts lessons to your strengths and weaknesses in real time.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Progress Tracking",
    description:
      "Track growth in grammar, vocabulary, comprehension, and fluency.",
  },
  {
    icon: <BookOpen className="size-5" />,
    title: "Structured Curriculum",
    description:
      "A1–C2 curriculum covering everything from basics to mastery.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Instant Feedback",
    description:
      "Get gentle, natural corrections exactly when they matter most.",
  },
  {
    icon: <Globe className="size-5" />,
    title: "3 Languages",
    description:
      "Learn French, Spanish, or German — each with a dedicated AI tutor.",
  },
];

const cefrLevels = [
  { level: "A1", name: "Beginner", desc: "Basic greetings & simple phrases", color: "from-sky-400 to-sky-600" },
  { level: "A2", name: "Elementary", desc: "Everyday conversations & past tense", color: "from-blue-400 to-blue-600" },
  { level: "B1", name: "Intermediate", desc: "Opinions, plans & complex ideas", color: "from-indigo-400 to-indigo-600" },
  { level: "B2", name: "Upper Int.", desc: "Detailed debate & nuanced discussion", color: "from-violet-400 to-violet-600" },
  { level: "C1", name: "Advanced", desc: "Abstract topics & literary language", color: "from-purple-400 to-purple-600" },
  { level: "C2", name: "Mastery", desc: "Native-level fluency & style", color: "from-fuchsia-500 to-purple-700" },
];

const steps = [
  {
    num: "1",
    title: "Choose Your Language",
    description: "Pick French, Spanish, or German and meet your personal AI tutor.",
    icon: <Globe className="size-5" />,
  },
  {
    num: "2",
    title: "Quick Placement Chat",
    description:
      "Have a natural conversation so the AI can understand your level.",
    icon: <MessageCircle className="size-5" />,
  },
  {
    num: "3",
    title: "Practice Daily",
    description: "Chat daily with structured lessons, reviews, and free conversation.",
    icon: <Star className="size-5" />,
  },
];

const stats = [
  { value: "3", label: "Languages", icon: <Globe className="size-5" /> },
  { value: "6", label: "CEFR Levels", icon: <BookOpen className="size-5" /> },
  { value: "24/7", label: "Available", icon: <MessageCircle className="size-5" /> },
  { value: "AI", label: "Powered", icon: <Brain className="size-5" /> },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTutor, setActiveTutor] = useState("fr");
  const { forceDark } = useTheme();

  // Always render landing page in dark mode
  useEffect(() => {
    return forceDark();
  }, [forceDark]);

  if (status === "authenticated") {
    router.replace("/dashboard");
    return null;
  }

  return (
    <>
      <SEO
        title="Lingua — AI-Powered Language Tutor"
        description="Learn French, Spanish, or German naturally through AI-powered conversations. Adaptive lessons from A1 to C2 with real-time feedback."
      />
      <div className="min-h-screen bg-background overflow-hidden">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <LinguaLogo className="size-4.5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">Lingua</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/signin">Sign In</Link>
              </Button>
              <Button size="sm" className="rounded-full px-5" asChild>
                <Link href="/auth/signup">
                  Get Started
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative py-20 lg:py-28 px-4">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 size-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 size-96 bg-primary/3 rounded-full blur-3xl" />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — copy */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5 rounded-full border-primary/20">
                  <Sparkles className="size-3.5 mr-2 text-primary" />
                  AI-Powered Language Learning
                </Badge>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6">
                  Learn languages the way
                  <span className="text-primary block mt-1">they&apos;re actually spoken</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                  Meet your AI tutor — <strong className="text-foreground">Amélie</strong> for French, <strong className="text-foreground">Sofía</strong> for Spanish, or <strong className="text-foreground">Hans</strong> for German. They remember your progress, correct you naturally, and adapt every conversation to your level.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-3 mb-10">
                  <Button size="lg" className="text-base px-7 rounded-full h-12 shadow-lg shadow-primary/20" asChild>
                    <Link href="/auth/signup">
                      Start Learning Free
                      <ArrowRight className="size-4 ml-2" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-7 rounded-full h-12"
                    asChild
                  >
                    <Link href="#how-it-works">See How It Works</Link>
                  </Button>
                </div>

                {/* Social proof bar */}
                <div className="flex items-center flex-wrap gap-4 sm:gap-6 text-sm text-muted-foreground">
                  {stats.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-primary">{s.icon}</span>
                      <div>
                        <p className="font-bold text-foreground text-base">{s.value}</p>
                        <p className="text-[11px]">{s.label}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Right — tabbed tutor demos */}
              <motion.div
                initial={{ opacity: 0, x: 30, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                className="hidden lg:block"
              >
                {/* Tutor tabs */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {tutorTabs.map((t) => (
                    <button
                      key={t.code}
                      onClick={() => setActiveTutor(t.code)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        activeTutor === t.code
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      <ReactCountryFlag
                        countryCode={t.countryCode}
                        svg
                        aria-label={t.countryCode}
                        style={{ width: "1.25em", height: "1.25em", display: "inline-block", verticalAlign: "middle" }}
                      />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
                <MockChat activeTutor={activeTutor} />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-xs rounded-full">Features</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Everything you need to learn a language
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                A comprehensive experience that makes learning feel like having a conversation with a friend.
              </p>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="group bg-card border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                >
                  <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CEFR Levels */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-xs rounded-full">Curriculum</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                From zero to fluency
              </h2>
              <p className="text-muted-foreground text-lg">
                CEFR-aligned levels covering every stage of your language journey.
              </p>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {cefrLevels.map((item, i) => (
                <motion.div
                  key={item.level}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                  className="text-center group"
                >
                  <div
                    className={`bg-gradient-to-br ${item.color} text-white size-14 sm:size-16 rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-2 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                  >
                    {item.level}
                  </div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 px-4 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-xs rounded-full">How It Works</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start in minutes</h2>
              <p className="text-muted-foreground text-lg">
                Three simple steps to your personalized language journey.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-8 items-start">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.4 }}
                  className="relative text-center flex flex-col items-center"
                >
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px bg-border" />
                  )}
                  <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 relative shrink-0">
                    {step.icon}
                    <span className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2 text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-12 md:p-16 relative overflow-hidden">
              <div className="absolute top-0 right-0 size-32 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 size-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Ready to learn a new language?
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                  Join Lingua and start having real conversations with your AI tutor today. No credit card required.
                </p>
                <Button size="lg" className="text-base px-8 rounded-full h-12 shadow-lg shadow-primary/20" asChild>
                  <Link href="/auth/signup">
                    Get Started Free
                    <ArrowRight className="size-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t py-8 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center">
                <LinguaLogo className="size-3.5 text-primary" />
              </div>
              <span className="text-sm">
                &copy; {new Date().getFullYear()} Lingua. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
