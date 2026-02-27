import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import SEO from "@/components/SEO";
import { motion } from "motion/react";

const FEATURES = [
  {
    icon: "🤖",
    title: "AI-Powered Conversations",
    description:
      "Chat naturally with Amélie, your personal French tutor powered by Claude AI. Get real-time corrections and explanations.",
  },
  {
    icon: "📈",
    title: "Adaptive Learning",
    description:
      "The curriculum adapts to your level from complete beginner (A0) to mastery (C2), following the CEFR framework.",
  },
  {
    icon: "🧠",
    title: "Spaced Repetition",
    description:
      "Smart review scheduling ensures you revisit concepts at the optimal time for long-term retention.",
  },
  {
    icon: "🎯",
    title: "Focused Practice",
    description:
      "Each session targets specific grammar and vocabulary concepts, building your skills systematically.",
  },
  {
    icon: "📊",
    title: "Detailed Progress Tracking",
    description:
      "See your skill breakdown, concept mastery, session history, and level progression at a glance.",
  },
  {
    icon: "🗣️",
    title: "Natural Conversations",
    description:
      "Practice real-world scenarios — ordering at a café, discussing art, debating philosophy — at your level.",
  },
];

const LEVELS = [
  { level: "A0", label: "Pre-Beginner", color: "bg-emerald-100 text-emerald-700" },
  { level: "A1", label: "Beginner", color: "bg-green-100 text-green-700" },
  { level: "A2", label: "Elementary", color: "bg-lime-100 text-lime-700" },
  { level: "B1", label: "Intermediate", color: "bg-yellow-100 text-yellow-700" },
  { level: "B2", label: "Upper Intermediate", color: "bg-orange-100 text-orange-700" },
  { level: "C1", label: "Advanced", color: "bg-red-100 text-red-700" },
  { level: "C2", label: "Mastery", color: "bg-purple-100 text-purple-700" },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  if (status === "loading" || session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <SEO />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600">Lingua</span>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-gray-950 dark:to-purple-950/30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
              <span>🇫🇷</span> Powered by AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
              Learn French with your
              <br />
              <span className="text-indigo-600 dark:text-indigo-400">personal AI tutor</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Meet Amélie — an AI-powered French tutor that adapts to your level,
              tracks your progress, and helps you speak confidently from day one.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold text-lg shadow-lg shadow-indigo-600/20"
              >
                Start learning for free
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-lg border border-gray-200 dark:border-gray-700"
              >
                See how it works
              </Link>
            </div>
          </motion.div>

          {/* Chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 max-w-2xl mx-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Practice Session</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🇫🇷</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-md">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      Bonjour ! Je suis Amélie. 😊 Aujourd&apos;hui, on va pratiquer les salutations.
                      Comment tu t&apos;appelles ?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="bg-indigo-600 px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-md">
                    <p className="text-sm text-white">Je m&apos;appelle Marie !</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🇫🇷</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-md">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      Enchanté, Marie ! 🎉 C&apos;est parfait ! Now let&apos;s try: how would you ask
                      someone&apos;s name politely?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to learn French
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A complete language learning system powered by AI, designed around how people actually learn languages.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CEFR Levels */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              From zero to fluent
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Follow the internationally recognized CEFR framework, with curriculum designed for each level.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {LEVELS.map((l) => (
              <div
                key={l.level}
                className={`${l.color} px-4 py-3 rounded-xl text-center min-w-[120px]`}
              >
                <div className="text-lg font-bold">{l.level}</div>
                <div className="text-xs font-medium opacity-80">{l.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How it works
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Take a placement test", desc: "A short AI-powered conversation assesses your current level — or start from scratch." },
              { step: "2", title: "Practice with Amélie", desc: "Have natural conversations, focused lessons, or review sessions tailored to your level." },
              { step: "3", title: "Track your progress", desc: "Watch your skills improve with detailed analytics, concept mastery, and level progression." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to start speaking French?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Join Lingua today and get your own AI French tutor. No credit card required.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold text-lg shadow-lg shadow-indigo-600/20"
          >
            Get started for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} Lingua. All rights reserved.
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Powered by Claude AI
          </span>
        </div>
      </footer>
    </div>
  );
}
