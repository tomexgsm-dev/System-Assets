import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /api/style — fetch current user's style preferences + prompt history
router.get("/style", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db
      .select({ stylePreferences: usersTable.stylePreferences, promptHistory: usersTable.promptHistory })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    res.json({
      stylePreferences: user?.stylePreferences ?? {},
      promptHistory: user?.promptHistory ?? [],
    });
  } catch (err: any) {
    console.error("[style] GET error:", err?.message);
    res.status(500).json({ error: "Failed to fetch style preferences" });
  }
});

// POST /api/style — save style preferences
router.post("/style", requireAuth, async (req: any, res) => {
  const { colors, font, layout, mood } = req.body ?? {};

  const stylePreferences = {
    colors: Array.isArray(colors) ? colors.slice(0, 6) : [],
    font: typeof font === "string" ? font.slice(0, 60) : "",
    layout: ["minimal", "modern", "classic", "bold", "elegant"].includes(layout) ? layout : "modern",
    mood: typeof mood === "string" ? mood.slice(0, 80) : "",
  };

  try {
    await db
      .update(usersTable)
      .set({ stylePreferences } as any)
      .where(eq(usersTable.id, req.session.userId));

    res.json({ success: true, stylePreferences });
  } catch (err: any) {
    console.error("[style] POST error:", err?.message);
    res.status(500).json({ error: "Failed to save style preferences" });
  }
});

// POST /api/style/history — append a prompt to history (called after generation)
router.post("/style/history", requireAuth, async (req: any, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const [user] = await db
      .select({ promptHistory: usersTable.promptHistory })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    const history: Array<{ prompt: string; date: string }> = Array.isArray(user?.promptHistory) ? user.promptHistory : [];
    const newEntry = { prompt: prompt.slice(0, 300), date: new Date().toISOString() };
    const updated = [newEntry, ...history].slice(0, 50); // keep last 50

    await db
      .update(usersTable)
      .set({ promptHistory: updated } as any)
      .where(eq(usersTable.id, req.session.userId));

    res.json({ success: true, count: updated.length });
  } catch (err: any) {
    console.error("[style] history error:", err?.message);
    res.status(500).json({ error: "Failed to save history" });
  }
});

export default router;
