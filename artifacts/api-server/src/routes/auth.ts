import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SALT_ROUNDS = 12;

router.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db
      .insert(usersTable)
      .values({ email, password: hashed })
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.plan = user.plan;

    res.status(201).json({ id: user.id, email: user.email, plan: user.plan });
  } catch (err) {
    console.error("Register error:", String(err));
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.plan = user.plan;

    res.json({ id: user.id, email: user.email, plan: user.plan });
  } catch (err) {
    console.error("Login error:", String(err));
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("nexus.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Me error:", String(err));
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
