import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Type, Layout, X, Save, Sparkles, Clock, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const LAYOUT_OPTIONS = [
  { value: "modern",  label: "Modern",  desc: "Clean lines, plenty of white space" },
  { value: "minimal", label: "Minimal", desc: "Ultra-clean, content-first" },
  { value: "classic", label: "Classic", desc: "Traditional, structured layout" },
  { value: "bold",    label: "Bold",    desc: "Strong visuals, large typography" },
  { value: "elegant", label: "Elegant", desc: "Refined, sophisticated look" },
];

const FONT_OPTIONS = [
  "Inter", "Roboto", "Poppins", "Playfair Display", "Montserrat",
  "Raleway", "Lato", "Oswald", "Source Sans Pro", "Nunito",
];

const PRESET_PALETTES = [
  { name: "Ocean",    colors: ["#0ea5e9", "#0284c7", "#f0f9ff", "#1e293b"] },
  { name: "Forest",  colors: ["#22c55e", "#16a34a", "#f0fdf4", "#14532d"] },
  { name: "Sunset",  colors: ["#f97316", "#ea580c", "#fff7ed", "#431407"] },
  { name: "Purple",  colors: ["#a855f7", "#9333ea", "#faf5ff", "#3b0764"] },
  { name: "Rose",    colors: ["#f43f5e", "#e11d48", "#fff1f2", "#4c0519"] },
  { name: "Slate",   colors: ["#64748b", "#475569", "#f8fafc", "#0f172a"] },
];

export interface StylePrefs {
  colors: string[];
  font: string;
  layout: string;
  mood: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function StyleSettings({ open, onClose }: Props) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<StylePrefs>({ colors: [], font: "Inter", layout: "modern", mood: "" });
  const [history, setHistory] = useState<Array<{ prompt: string; date: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"style" | "history">("style");
  const [customColor, setCustomColor] = useState("#6366f1");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${BASE}/api/style`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.stylePreferences && typeof data.stylePreferences === "object") {
          setPrefs({
            colors: data.stylePreferences.colors ?? [],
            font: data.stylePreferences.font ?? "Inter",
            layout: data.stylePreferences.layout ?? "modern",
            mood: data.stylePreferences.mood ?? "",
          });
        }
        if (Array.isArray(data.promptHistory)) {
          setHistory(data.promptHistory);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Style preferences saved!", description: "All future generations will use these settings." });
      onClose();
    } catch {
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addColor = (color: string) => {
    if (prefs.colors.includes(color) || prefs.colors.length >= 6) return;
    setPrefs((p) => ({ ...p, colors: [...p.colors, color] }));
  };

  const removeColor = (color: string) => {
    setPrefs((p) => ({ ...p, colors: p.colors.filter((c) => c !== color) }));
  };

  const applyPalette = (colors: string[]) => {
    setPrefs((p) => ({ ...p, colors }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Style Preferences</h2>
                  <p className="text-xs text-muted-foreground">AI will match your taste every generation</p>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40">
              {(["style", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    tab === t
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "style" ? "Style Settings" : `Prompt History (${history.length})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tab === "style" ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Color palettes */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> Color Palette
                    <span className="ml-auto text-[10px] font-normal">{prefs.colors.length}/6 colors</span>
                  </label>

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_PALETTES.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => applyPalette(p.colors)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="flex gap-0.5">
                          {p.colors.slice(0, 3).map((c) => (
                            <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="text-[11px] font-medium text-foreground">{p.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Current palette */}
                  {prefs.colors.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {prefs.colors.map((c) => (
                        <div key={c} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/50 text-xs">
                          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
                          <span className="text-muted-foreground font-mono text-[10px]">{c}</span>
                          <button onClick={() => removeColor(c)} className="text-muted-foreground hover:text-red-400 transition-colors ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom color picker */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-muted-foreground font-mono">{customColor}</span>
                    <button
                      onClick={() => addColor(customColor)}
                      disabled={prefs.colors.includes(customColor) || prefs.colors.length >= 6}
                      className="ml-auto px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-40"
                    >
                      + Add color
                    </button>
                  </div>
                </div>

                {/* Font */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" /> Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f}
                        onClick={() => setPrefs((p) => ({ ...p, font: f }))}
                        className={`px-3 py-2 rounded-lg text-left text-xs font-medium transition-all border ${
                          prefs.font === f
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 hover:border-primary/40 hover:bg-primary/5 text-foreground"
                        }`}
                        style={{ fontFamily: f }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5" /> Layout Style
                  </label>
                  <div className="space-y-1.5">
                    {LAYOUT_OPTIONS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setPrefs((p) => ({ ...p, layout: l.value }))}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all border ${
                          prefs.layout === l.value
                            ? "border-primary bg-primary/10"
                            : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${prefs.layout === l.value ? "bg-primary" : "bg-muted"}`} />
                        <div>
                          <span className="text-xs font-semibold text-foreground">{l.label}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">{l.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Mood / Tone
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">optional</span>
                  </label>
                  <input
                    type="text"
                    value={prefs.mood}
                    onChange={(e) => setPrefs((p) => ({ ...p, mood: e.target.value.slice(0, 80) }))}
                    placeholder='e.g. "professional and trustworthy" or "fun and energetic"'
                    className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            ) : (
              /* History tab */
              <div className="flex-1 overflow-y-auto p-5">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <Clock className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No generation history yet</p>
                    <p className="text-xs text-muted-foreground/60">Your prompts will appear here after generating</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/40">
                        <p className="text-xs text-foreground leading-relaxed">{h.prompt}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {new Date(h.date).toLocaleDateString("pl-PL", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {tab === "style" && (
              <div className="p-5 border-t border-border/40 flex items-center gap-3">
                <p className="text-xs text-muted-foreground flex-1">
                  These preferences are applied automatically to every new generation.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors shadow-lg disabled:opacity-60"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save preferences
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
