import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles, ExternalLink, Crown, Loader2, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBuilderGenerations } from "@/hooks/use-builder";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const FREE_LIMIT = 3;

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const { data: generations, isLoading: gensLoading } = useBuilderGenerations();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("upgraded") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      // Sync the session plan with the DB (Stripe webhook may have upgraded it)
      fetch(`${BASE}/api/stripe/verify-upgrade`, {
        method: "POST",
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data) => {
          // Invalidate auth cache so the UI shows PRO plan
          queryClient.invalidateQueries({ queryKey: ["auth-me"] });
          if (data.plan === "pro") {
            toast({ title: "Welcome to PRO!", description: "You now have unlimited website generations." });
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const genCount = generations?.length ?? 0;
  const isPro = user?.plan === "pro";
  const atLimit = !isPro && genCount >= FREE_LIMIT;

  const handleUpgrade = async () => {
    try {
      // Fetch products from Stripe
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

      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      }
    } catch {
      toast({ title: "Error", description: "Failed to start checkout.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">Nexus Builder</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Builder
            </button>
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* User info + plan */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
          </div>

          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isPro ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-muted/50 border-border"}`}>
            {isPro ? <Crown className="w-4 h-4" /> : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{isPro ? "PRO Plan" : "Free Plan"}</p>
              <p className="text-sm font-semibold text-foreground">
                {isPro ? "Unlimited websites" : `${genCount} / ${FREE_LIMIT} websites used`}
              </p>
            </div>
            {!isPro && (
              <button
                onClick={handleUpgrade}
                className="ml-2 bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Crown className="w-3 h-3" />
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Limit banner */}
        {atLimit && (
          <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-orange-700 dark:text-orange-400 text-sm">Free plan limit reached</p>
              <p className="text-xs text-orange-600 dark:text-orange-300 mt-0.5">Upgrade to PRO for unlimited website generations at just $9.99.</p>
            </div>
            <button
              onClick={handleUpgrade}
              className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Upgrade — $9.99
            </button>
          </div>
        )}

        {/* Projects list */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-semibold text-foreground">My Projects ({genCount})</h2>
          {!atLimit && (
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary font-medium px-3 py-1.5 rounded-lg transition-colors border border-primary/20"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          )}
        </div>

        {gensLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : genCount === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl">
            <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">No projects yet</p>
            <p className="text-sm text-muted-foreground mb-4">Go back to the builder and create your first website.</p>
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
              <div key={gen.id} className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-border transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm line-clamp-1">{gen.prompt}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(gen.createdAt), "MMM d, yyyy • h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/?project=${gen.id}`)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
                  >
                    Preview
                  </button>
                  <a
                    href={`${BASE}/api/project/${gen.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-primary/10"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
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
