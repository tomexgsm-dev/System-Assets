import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const FREE_STARTING_CREDITS = 10;

// ─── Credit check ─────────────────────────────────────────────────────────────

export interface CreditResult {
  allowed: boolean;
  credits: number;
  plan: string;
  reason?: string;
}

export async function checkCredits(userId: number): Promise<CreditResult> {
  const [row] = await db
    .select({ plan: usersTable.plan, credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!row) {
    return { allowed: false, credits: 0, plan: "free", reason: "User not found." };
  }

  // PRO users always allowed
  if (row.plan === "pro") {
    return { allowed: true, credits: 999999, plan: "pro" };
  }

  const credits = row.credits ?? 0;

  if (credits <= 0) {
    return {
      allowed: false,
      credits: 0,
      plan: "free",
      reason: "No credits left 💸. Upgrade to PRO for unlimited use.",
    };
  }

  return { allowed: true, credits, plan: "free" };
}

// ─── Deduct one credit (free users only) ──────────────────────────────────────

export async function useCredit(userId: number): Promise<void> {
  const [row] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  // PRO users: no deduction
  if (!row || row.plan === "pro") return;

  await db
    .update(usersTable)
    .set({ credits: sql`GREATEST(${usersTable.credits} - 1, 0)` })
    .where(eq(usersTable.id, userId));
}

// ─── Activate PRO (called from Stripe webhook) ────────────────────────────────

export async function activatePro(userId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ plan: "pro", credits: 999999 } as any)
    .where(eq(usersTable.id, userId));
}

// ─── Revert to FREE (called when subscription cancelled) ─────────────────────

export async function revertToFree(userId: number): Promise<void> {
  await db
    .update(usersTable)
    .set({ plan: "free", credits: FREE_STARTING_CREDITS } as any)
    .where(eq(usersTable.id, userId));
}

// ─── Legacy helpers kept for deploy.ts compatibility ─────────────────────────

export async function checkGenerationLimit(userId: number): Promise<CreditResult> {
  return checkCredits(userId);
}

export async function checkPublishLimit(userId: number): Promise<CreditResult> {
  return checkCredits(userId);
}

export async function incrementGenerationCount(_userId: number): Promise<void> {
  // tracking moved to useCredit
}

export async function incrementPublishCount(userId: number): Promise<void> {
  await useCredit(userId);
}
