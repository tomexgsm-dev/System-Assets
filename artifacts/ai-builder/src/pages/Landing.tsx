import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Sparkles, Zap, Globe, Download, Code2, Crown, Check, ChevronDown,
  Star, ArrowRight, Layers, Palette, Shield, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  { icon: Zap,        title: "Lightning Fast",        desc: "Full multi-page website ready in under 60 seconds. No waiting, no fuss." },
  { icon: Layers,     title: "Multi-File Projects",   desc: "Generates HTML, CSS, and JS as separate, clean, production-ready files." },
  { icon: Globe,      title: "1-Click Publish",       desc: "Deploy to Netlify or WordPress with one click. Go live instantly." },
  { icon: Code2,      title: "Monaco Code Editor",    desc: "Edit every file directly in the browser with full syntax highlighting." },
  { icon: Download,   title: "ZIP Download",          desc: "Export the full project as a ZIP and host it anywhere you like." },
  { icon: RefreshCw,  title: "AI Refinement",         desc: "Describe changes and the AI updates your site — no credits deducted." },
  { icon: Palette,    title: "Style Presets",         desc: "Choose color palettes, fonts, and layouts before generating." },
  { icon: Shield,     title: "WCAG Checked",          desc: "Every generated page is automatically checked for accessibility." },
];

const STEPS = [
  { num: "01", title: "Describe your site", desc: "Type what you need — a landing page, portfolio, restaurant menu, SaaS pricing page. In any language." },
  { num: "02", title: "AI builds it",       desc: "Choose GPT, Claude, or Groq. The AI generates a complete multi-page website in seconds." },
  { num: "03", title: "Publish or export",  desc: "Hit Publish to go live on Netlify. Or download the ZIP and host anywhere." },
];

const TESTIMONIALS = [
  { name: "Anna K.",   role: "Freelance Designer",  text: "I built a client landing page in 2 minutes. The code it generates is actually clean — I was shocked.", stars: 5 },
  { name: "Marek W.",  role: "Small Business Owner", text: "Finally launched my restaurant website without paying an agency. Total game changer.", stars: 5 },
  { name: "Piotr S.",  role: "Startup Founder",      text: "We prototyped 6 landing page variants in one afternoon for A/B testing. Incredible time saver.", stars: 5 },
];

const FAQS = [
  { q: "What is a credit?",            a: "Each AI website generation or publish costs 1 credit. Refinements (improving an existing site) are always free." },
  { q: "What happens when I run out?", a: "You'll see a prompt to upgrade. Your existing sites are never deleted. Upgrade to PRO for unlimited use." },
  { q: "Which AI models are available?", a: "GPT (OpenAI), Claude Sonnet (Anthropic), and Llama 3.3 via Groq. You choose per generation." },
  { q: "Can I use the code commercially?", a: "Yes. All generated code is yours. Use it however you like — no attribution required." },
  { q: "Do I need a credit card for Free?", a: "No. Sign up with just your email. No credit card required until you upgrade." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-medium text-white">{q}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    document.title = "Nexus Builder — AI Website Builder";
  }, []);

  // If already logged in, send straight to the builder
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/app");
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-violet-600/20 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-64 w-[600px] h-[600px] bg-gradient-radial from-blue-600/10 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-fuchsia-600/10 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Nexus Builder</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2 text-sm font-semibold bg-white text-black rounded-xl hover:bg-white/90 transition-colors"
          >
            Get started free
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8"
        >
          <Sparkles className="w-3 h-3" />
          Powered by GPT · Claude · Llama 3.3
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 max-w-4xl"
        >
          Build a website{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            in 30 seconds
          </span>{" "}
          with AI
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-white/60 max-w-xl mb-10 leading-relaxed"
        >
          Describe what you need. AI generates a complete, multi-page website with clean code.
          Publish to Netlify with one click — no coding required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <button
            onClick={() => navigate("/register")}
            className="group flex items-center gap-2 px-7 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl font-bold text-white text-base shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 transition-all duration-200"
          >
            Start building for free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-7 py-4 rounded-2xl font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white text-base transition-all"
          >
            Sign in
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-5 text-xs text-white/30"
        >
          Free plan includes 10 credits · No credit card required
        </motion.p>

        {/* Mock preview */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 w-full max-w-5xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/50"
        >
          {/* Browser chrome */}
          <div className="bg-[#1a1a2e] border-b border-white/10 px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-white/5 rounded-lg px-4 py-1.5 text-xs text-white/30 text-center">
                nexus-builder.app
              </div>
            </div>
          </div>
          {/* App screenshot mock */}
          <div className="bg-[#0d0d1a] p-0 flex" style={{ minHeight: 380 }}>
            {/* Sidebar mock */}
            <div className="w-64 border-r border-white/5 bg-[#111120] p-4 flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                <div className="h-3 w-24 bg-white/10 rounded" />
              </div>
              {[90, 70, 80, 65, 75].map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className={`h-2 bg-white/10 rounded`} style={{ width: `${w}%` }} />
                    <div className="h-2 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
            {/* Main area mock */}
            <div className="flex-1 flex flex-col">
              {/* Prompt bar */}
              <div className="border-b border-white/5 p-3 flex items-center gap-3">
                <div className="flex-1 bg-white/5 rounded-xl px-4 h-10 flex items-center">
                  <span className="text-xs text-white/30">Modern SaaS landing page with pricing, hero section and features...</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              {/* Preview pane */}
              <div className="flex-1 p-4 relative">
                <div className="h-full rounded-xl bg-gradient-to-br from-[#1a1040] via-[#0f0a2a] to-[#080818] border border-white/5 overflow-hidden relative">
                  <div className="p-6">
                    <div className="h-4 w-32 bg-violet-500/30 rounded-full mb-4" />
                    <div className="h-8 w-64 bg-white/10 rounded-xl mb-2" />
                    <div className="h-8 w-48 bg-gradient-to-r from-violet-500/40 to-fuchsia-500/40 rounded-xl mb-6" />
                    <div className="h-4 w-80 bg-white/5 rounded mb-2" />
                    <div className="h-4 w-72 bg-white/5 rounded mb-8" />
                    <div className="flex gap-3">
                      <div className="h-10 w-32 bg-violet-600/60 rounded-xl" />
                      <div className="h-10 w-28 bg-white/10 rounded-xl" />
                    </div>
                    <div className="mt-10 grid grid-cols-3 gap-4">
                      {[0,1,2].map(i => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 space-y-2">
                          <div className="w-8 h-8 bg-violet-500/30 rounded-lg" />
                          <div className="h-3 bg-white/10 rounded w-3/4" />
                          <div className="h-2 bg-white/5 rounded" />
                          <div className="h-2 bg-white/5 rounded w-4/5" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Animated typing cursor */}
                  <div className="absolute bottom-6 right-6 flex items-center gap-1.5 bg-white/5 rounded-lg px-3 py-1.5">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white/40">AI generating...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <Section className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-4xl md:text-5xl font-bold">From idea to live website in 3 steps</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative flex flex-col gap-4"
            >
              <div className="text-6xl font-black text-white/5 select-none leading-none">{s.num}</div>
              <div className="-mt-8">
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
              {i < 2 && (
                <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 text-white/20">
                  <ArrowRight className="w-6 h-6" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Features ── */}
      <Section className="relative z-10 px-6 py-24 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold">Everything you need</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="group p-5 rounded-2xl border border-white/8 bg-white/[0.03] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4 group-hover:bg-violet-500/25 transition-colors">
                  <f.icon className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Pricing ── */}
      <Section className="relative z-10 px-6 py-24 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-4xl md:text-5xl font-bold">Simple, honest pricing</h2>
          <p className="text-white/50 mt-4">Start free, upgrade when you need more.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col"
          >
            <div className="mb-6">
              <p className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black">$0</span>
                <span className="text-white/40 text-sm">/ forever</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "10 credits total",
                "All 3 AI models",
                "ZIP download",
                "Monaco code editor",
                "Unlimited refinements",
                "Style presets",
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/register")}
              className="w-full py-3.5 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors"
            >
              Get started free
            </button>
          </motion.div>

          {/* PRO */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-8 rounded-2xl border border-violet-500/40 bg-gradient-to-b from-violet-600/10 to-fuchsia-600/5 flex flex-col overflow-hidden"
          >
            <div className="absolute top-4 right-4">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold">
                <Crown className="w-3 h-3" />
                PRO
              </span>
            </div>
            <div className="mb-6">
              <p className="text-sm font-semibold text-violet-300 uppercase tracking-wider mb-2">PRO</p>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black">$9.99</span>
                <span className="text-white/40 text-sm">/ month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Unlimited generations",
                "Unlimited publishes",
                "All 3 AI models",
                "Netlify & WordPress publish",
                "ZIP download",
                "Monaco code editor",
                "Unlimited refinements",
                "Priority support",
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                  <Check className="w-4 h-4 text-violet-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate("/register")}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/30"
            >
              Start PRO →
            </button>
          </motion.div>
        </div>
      </Section>

      {/* ── Testimonials ── */}
      <Section className="relative z-10 px-6 py-24 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl md:text-5xl font-bold">Loved by builders</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-6 rounded-2xl border border-white/8 bg-white/[0.03]"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section className="relative z-10 px-6 py-24 max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-4xl font-bold">Questions answered</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </Section>

      {/* ── Final CTA ── */}
      <Section className="relative z-10 px-6 py-32 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-violet-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-5">
            Ready to build your website?{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Start now.
            </span>
          </h2>
          <p className="text-white/50 mb-10 text-lg">
            10 free credits. No credit card. Your first site in under a minute.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl font-bold text-white text-lg shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 transition-all duration-200"
          >
            Create your free account
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </Section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Nexus Builder</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <button onClick={() => navigate("/login")} className="hover:text-white/60 transition-colors">Sign in</button>
            <button onClick={() => navigate("/register")} className="hover:text-white/60 transition-colors">Register</button>
            <button onClick={() => navigate("/dashboard")} className="hover:text-white/60 transition-colors">Dashboard</button>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Nexus Builder</p>
        </div>
      </footer>
    </div>
  );
}
