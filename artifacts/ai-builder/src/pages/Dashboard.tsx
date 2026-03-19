import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Sparkles, ExternalLink, Crown, Loader2, Plus, ArrowLeft,
  Zap, Globe, BarChart2, CreditCard, LogOut, RefreshCw,
  CheckCircle2, AlertCircle, Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBuilderGenerations } from "@/hooks/use-builder";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const FREE_STARTING_CREDITS = 10;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  color = "violet",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
  color?: "violet" | "amber" | "green" | "blue" | "orange";
}) {
  const colorMap = {
    violet: "from-violet-600/20 to-fuchsia-600/10 border-violet-500/30 text-violet-400",
    amber:  "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
    green:  "from-green-600/20 to-emerald-600/10 border-green-500/30 text-green-400",
    blue:   "from-blue-600/20 to-cyan-600/10 border-blue-500/30 text-blue-400",
    orange: "from-orange-600/20 to-red-600/10 border-orange-500/30 text-orange-400",
  };
  return (
    <div className={`relative p-5 rounded-2xl border bg-gradient-to-br ${colorMap[color]} ${highlight ? "ring-2 ring-amber-500/40" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {highlight && <Crown className="w-4 h-4 text-amber-400" />}
      </div>
      <p className="text-2xl font-black text-white tracking-tight leading-none mb-1">{value}</p>
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[11px] text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { data: generations, isLoading: gensLoading } = useBuilderGenerations();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("upgraded") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      fetch(`${BASE}/api/stripe/verify-upgrade`, { method: "POST", credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          queryClient.invalidateQueries({ queryKey: ["auth-me"] });
          if (data.plan === "pro") {
            toast({ title: "Welcome to PRO! 🎉", description: "You now have unlimited generations and publishes." });
          } else {
            toast({ title: "Payment received!", description: "Your plan will be upgraded shortly." });
          }
        })
        .catch(() => {
          toast({ title: "Welcome to PRO!", description: "Your account has been upgraded." });
        });
    }

    if (params.get("canceled") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      toast({ title: "Payment canceled", description: "No charge was made.", variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPro        = user?.plan === "pro";
  const credits      = isPro ? Infinity : (user?.credits ?? 0);
  const genCount     = generations?.length ?? 0;
  const publishCount = user?.publishCount ?? 0;
  const dailyGen     = user?.dailyGenCount ?? 0;
  const monthlyGen   = user?.monthlyGenCount ?? 0;
  const outOfCredits = !isPro && credits <= 0;
  const hasStripe    = !!user?.stripeSubscriptionId;

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch(`${BASE}/api/stripe/products`, { credentials: "include" });
      const data = await res.json();
      const products = data.data ?? [];
      const proPlan = products.find((p: any) => p.name === "Pro Plan");
      const price = proPlan?.prices?.[0];

      if (!price) {
        toast({ title: "Stripe not connected", description: "Please set up Stripe to enable payments.", variant: "destructive" });
        return;
      }

      const checkoutRes = await fetch(`${BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: price.id }),
      });
      const checkoutData = await checkoutRes.json();
      if (checkoutData.url) window.location.href = checkoutData.url;
    } catch {
      toast({ title: "Error", description: "Failed to start checkout.", variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ── */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">Nexus Builder</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              Builder
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Page title ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          {/* Plan */}
          <StatCard
            icon={isPro ? Crown : Sparkles}
            label="Plan"
            value={isPro ? "PRO" : "Free"}
            sub={isPro ? "Active subscription" : "Upgrade for unlimited"}
            highlight={isPro}
            color={isPro ? "amber" : "violet"}
          />

          {/* Credits */}
          <StatCard
            icon={Zap}
            label="Credits"
            value={isPro ? "∞" : credits <= 0 ? "0" : String(credits)}
            sub={isPro ? "Unlimited" : `of ${FREE_STARTING_CREDITS} remaining`}
            color={outOfCredits ? "orange" : isPro ? "green" : credits <= 3 ? "orange" : "blue"}
          />

          {/* Total publishes */}
          <StatCard
            icon={Globe}
            label="Published"
            value={publishCount}
            sub="All-time deploys"
            color="green"
          />

          {/* Total projects */}
          <StatCard
            icon={Layers}
            label="Projects"
            value={genCount}
            sub="Websites generated"
            color="violet"
          />

        </div>

        {/* ── Second row: usage stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={BarChart2}
            label="Today"
            value={dailyGen}
            sub="Generations today"
            color="blue"
          />
          <StatCard
            icon={RefreshCw}
            label="This month"
            value={monthlyGen}
            sub="Generations this month"
            color="violet"
          />
          <StatCard
            icon={CreditCard}
            label="Subscription"
            value={isPro ? "Active" : "—"}
            sub={
              isPro
                ? hasStripe
                  ? "Managed via Stripe"
                  : "Manual activation"
                : "No subscription"
            }
            color={isPro ? "green" : "violet"}
          />
        </div>

        {/* ── Upgrade / Status banner ── */}
        {!isPro && (
          <div className={`mb-8 p-5 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${outOfCredits ? "bg-orange-500/10 border-orange-500/30" : "bg-violet-500/10 border-violet-500/20"}`}>
            <div className="flex items-center gap-3">
              {outOfCredits
                ? <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
                : <Crown className="w-5 h-5 text-violet-400 shrink-0" />}
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {outOfCredits ? "You're out of credits 💸" : "Upgrade to PRO"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {outOfCredits
                    ? "Upgrade to PRO for unlimited generations and publishing at $9.99/month."
                    : `${credits} credit${credits === 1 ? "" : "s"} left. PRO gives you unlimited access for $9.99/month.`}
                </p>
              </div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-violet-500/20"
            >
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {upgrading ? "Redirecting…" : "Upgrade to PRO — $9.99"}
            </button>
          </div>
        )}

        {isPro && (
          <div className="mb-8 p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">PRO plan active</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have unlimited generations, unlimited publishing, and all AI models available.
              </p>
            </div>
          </div>
        )}

        {/* ── Projects list ── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-semibold text-foreground text-lg">My Projects ({genCount})</h2>
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary font-medium px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
          >
            <Plus className="w-4 h-4" />
            New project
          </button>
        </div>

        {gensLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : genCount === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl">
            <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">No projects yet</p>
            <p className="text-sm text-muted-foreground mb-4">Go to the builder and create your first website.</p>
            <button
              onClick={() => navigate("/app")}
              className="bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-glow"
            >
              Start building
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {generations?.map((gen) => (
              <div
                key={gen.id}
                className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border transition-colors group"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm line-clamp-1">{gen.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(gen.createdAt), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/app?project=${gen.id}`)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted"
                  >
                    Open
                  </button>
                  <a
                    href={`${BASE}/api/project/${gen.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium px-2 py-1.5 rounded-lg hover:bg-primary/10 border border-primary/20"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Preview
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
