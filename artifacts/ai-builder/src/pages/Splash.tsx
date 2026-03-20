import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, Zap, Globe, Code2 } from "lucide-react";

const DURATION = 30;

const TAGLINES = [
  "Generating ideas...",
  "Crafting pixel-perfect layouts...",
  "Powering up the AI engine...",
  "Building your future website...",
  "Connecting GPT · Claude · Llama...",
  "Ready to launch in seconds...",
];

export default function Splash() {
  const [, navigate] = useLocation();
  const [elapsed, setElapsed] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);

  // If already seen this session, skip straight to landing
  useEffect(() => {
    if (sessionStorage.getItem("splashShown")) {
      navigate("/landing");
    } else {
      sessionStorage.setItem("splashShown", "1");
    }
  }, [navigate]);

  useEffect(() => {
    if (elapsed >= DURATION) {
      navigate("/landing");
      return;
    }
    const t = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(t);
  }, [elapsed, navigate]);

  // Rotate tagline every 5 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const progress = (elapsed / DURATION) * 100;
  const remaining = DURATION - elapsed;

  return (
    <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-center overflow-hidden select-none">

      {/* Animated background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #ec4899 0%, transparent 70%)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 60%)" }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute w-1 h-1 rounded-full bg-violet-400/40"
          style={{
            left: `${5 + (i * 4.7) % 92}%`,
            top: `${10 + (i * 7.3) % 80}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-xl">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-500/40">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          {/* Pulsing ring */}
          <motion.div
            className="absolute inset-0 rounded-3xl border-2 border-violet-400/50"
            animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-3xl border border-violet-300/30"
            animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          />
        </motion.div>

        {/* Brand name */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h1 className="text-5xl font-black text-white tracking-tight mb-2">
            Nexus<span className="text-violet-400"> Builder</span>
          </h1>
          <p className="text-lg text-gray-400 font-medium">
            AI Website Builder · GPT · Claude · Llama 3.3
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {[
            { icon: Zap,    label: "60s Websites" },
            { icon: Globe,  label: "1-Click Deploy" },
            { icon: Code2,  label: "Clean Code" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300"
            >
              <Icon className="w-3.5 h-3.5 text-violet-400" />
              {label}
            </div>
          ))}
        </motion.div>

        {/* Animated tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="h-7"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={taglineIdx}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-violet-300/80 font-medium"
            >
              ✦ {TAGLINES[taglineIdx]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Progress bar + countdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="w-full max-w-sm flex flex-col gap-3"
        >
          {/* Bar track */}
          <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "linear" }}
            />
            {/* shimmer */}
            <motion.div
              className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
              animate={{ x: ["-80px", "400px"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Loading experience…</span>
            <span className="tabular-nums font-medium text-violet-400">{remaining}s</span>
          </div>
        </motion.div>

        {/* Skip button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          onClick={() => navigate("/landing")}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2"
        >
          Skip intro
        </motion.button>
      </div>

      {/* Bottom branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 text-xs text-gray-700"
      >
        nexus-builder.app · Powered by AI
      </motion.div>
    </div>
  );
}
