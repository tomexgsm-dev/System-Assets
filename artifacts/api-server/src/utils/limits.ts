import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ─── Limit thresholds ─────────────────────────────────────────────────────────
export const FREE_DAILY_GEN   = 3;
export const FREE_MONTHLY_GEN = 30;
export const FREE_DAILY_PUB   = 3;
export const FREE_MONTHLY_PUB = 10;

type CounterType = "gen" | "pub";

// Returns today's date as YYYY-MM-DD string in UTC
function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

// Returns this month as YYYY-MM string in UTC
function thisMonthUTC(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── Generation limits ────────────────────────────────────────────────────────

export interface LimitResult {
  allowed: boolean;
  daily: number;
  dailyLimit: number;
  monthly: number;
  monthlyLimit: number;
  reason?: string;
}

export async function checkGenerationLimit(userId: number): Promise<LimitResult> {
  const [row] = await db
    .select({
      plan:            usersTable.plan,
      dailyGenCount:   usersTable.dailyGenCount,
      monthlyGenCount: usersTable.monthlyGenCount,
      lastGenDate:     usersTable.lastGenDate,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!row || row.plan !== "free") {
    return { allowed: true, daily: 0, dailyLimit: Infinity, monthly: 0, monthlyLimit: Infinity };
  }

  const today = todayUTC();
  const thisMonth = thisMonthUTC();

  // Reset daily counter if it's a new day
  const lastDate = row.lastGenDate ? String(row.lastGenDate) : null;
  let daily   = row.dailyGenCount   ?? 0;
  let monthly = row.monthlyGenCount ?? 0;

  if (!lastDate || lastDate < today) {
    // New day → reset daily counter (month counter resets on month boundary)
    await db.update(usersTable)
      .set({ dailyGenCount: 0, lastGenDate: today } as any)
      .where(eq(usersTable.id, userId));
    daily = 0;
  }

  // Reset monthly counter if it's a new month
  if (!lastDate || lastDate.slice(0, 7) < thisMonth) {
    await db.update(usersTable)
      .set({ monthlyGenCount: 0 } as any)
      .where(eq(usersTable.id, userId));
    monthly = 0;
  }

  if (daily >= FREE_DAILY_GEN) {
    return {
      allowed: false, daily, dailyLimit: FREE_DAILY_GEN, monthly, monthlyLimit: FREE_MONTHLY_GEN,
      reason: `Free plan allows ${FREE_DAILY_GEN} generations per day. Resets at midnight UTC. Upgrade to PRO for unlimited.`,
    };
  }

  if (monthly >= FREE_MONTHLY_GEN) {
    return {
      allowed: false, daily, dailyLimit: FREE_DAILY_GEN, monthly, monthlyLimit: FREE_MONTHLY_GEN,
      reason: `Free plan allows ${FREE_MONTHLY_GEN} generations per month. Upgrade to PRO for unlimited.`,
    };
  }

  return { allowed: true, daily, dailyLimit: FREE_DAILY_GEN, monthly, monthlyLimit: FREE_MONTHLY_GEN };
}

export async function incrementGenerationCount(userId: number): Promise<void> {
  const today = todayUTC();
  await db.update(usersTable)
    .set({
      dailyGenCount:   sql`${usersTable.dailyGenCount}   + 1`,
      monthlyGenCount: sql`${usersTable.monthlyGenCount} + 1`,
      lastGenDate: today,
    } as any)
    .where(eq(usersTable.id, userId));
}

// ─── Publish limits ───────────────────────────────────────────────────────────

export async function checkPublishLimit(userId: number): Promise<LimitResult> {
  const [row] = await db
    .select({
      plan:            usersTable.plan,
      dailyPubCount:   usersTable.dailyPubCount,
      monthlyPubCount: usersTable.monthlyPubCount,
      lastPubDate:     usersTable.lastPubDate,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!row || row.plan !== "free") {
    return { allowed: true, daily: 0, dailyLimit: Infinity, monthly: 0, monthlyLimit: Infinity };
  }

  const today = todayUTC();
  const thisMonth = thisMonthUTC();
  const lastDate = row.lastPubDate ? String(row.lastPubDate) : null;

  let daily   = row.dailyPubCount   ?? 0;
  let monthly = row.monthlyPubCount ?? 0;

  if (!lastDate || lastDate < today) {
    await db.update(usersTable)
      .set({ dailyPubCount: 0, lastPubDate: today } as any)
      .where(eq(usersTable.id, userId));
    daily = 0;
  }

  if (!lastDate || lastDate.slice(0, 7) < thisMonth) {
    await db.update(usersTable)
      .set({ monthlyPubCount: 0 } as any)
      .where(eq(usersTable.id, userId));
    monthly = 0;
  }

  if (daily >= FREE_DAILY_PUB) {
    return {
      allowed: false, daily, dailyLimit: FREE_DAILY_PUB, monthly, monthlyLimit: FREE_MONTHLY_PUB,
      reason: `Free plan allows ${FREE_DAILY_PUB} publishes per day. Resets at midnight UTC. Upgrade to PRO for unlimited.`,
    };
  }

  if (monthly >= FREE_MONTHLY_PUB) {
    return {
      allowed: false, daily, dailyLimit: FREE_DAILY_PUB, monthly, monthlyLimit: FREE_MONTHLY_PUB,
      reason: `Free plan allows ${FREE_MONTHLY_PUB} publishes per month. Upgrade to PRO for unlimited.`,
    };
  }

  return { allowed: true, daily, dailyLimit: FREE_DAILY_PUB, monthly, monthlyLimit: FREE_MONTHLY_PUB };
}

export async function incrementPublishCount(userId: number): Promise<void> {
  const today = todayUTC();
  await db.update(usersTable)
    .set({
      publishCount:    sql`${usersTable.publishCount}    + 1`,
      dailyPubCount:   sql`${usersTable.dailyPubCount}   + 1`,
      monthlyPubCount: sql`${usersTable.monthlyPubCount} + 1`,
      lastPubDate: today,
    } as any)
    .where(eq(usersTable.id, userId));
}
