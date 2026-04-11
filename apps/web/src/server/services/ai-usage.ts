import crypto from "crypto";
import { db, eq } from "@repo/db";
import { aiGuestQuota, aiUsageEvent, aiUsageQuota } from "@repo/db/schema";

type UsageShape = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type QuotaDbAdapter = Pick<typeof db, "select" | "insert" | "update">;

function getDefaultMonthlyCredits() {
  const configured = Number(process.env.AI_MONTHLY_CREDIT_LIMIT);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 100;
}

function getDefaultGuestMonthlyCredits() {
  const configured = Number(process.env.AI_GUEST_MONTHLY_CREDIT_LIMIT);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 2;
}

function getNextResetDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

function getTokensPerCredit() {
  const configured = Number(process.env.AI_TOKENS_PER_CREDIT);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 2500;
}

function getTotalTokens(usage?: UsageShape | null) {
  if (!usage) return 0;

  const total = usage.totalTokens;
  if (typeof total === "number" && Number.isFinite(total) && total > 0) {
    return total;
  }

  const prompt = typeof usage.promptTokens === "number" ? usage.promptTokens : 0;
  const completion = typeof usage.completionTokens === "number" ? usage.completionTokens : 0;
  return Math.max(0, prompt + completion);
}

export function estimateAiCreditsFromUsage(usage?: UsageShape | null) {
  const totalTokens = getTotalTokens(usage);

  if (totalTokens <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalTokens / getTokensPerCredit()));
}

async function getOrCreateQuotaForUpdate(tx: QuotaDbAdapter, userId: string) {
  const [existing] = await tx.select().from(aiUsageQuota).where(eq(aiUsageQuota.userId, userId)).limit(1);

  const defaultLimit = getDefaultMonthlyCredits();
  const now = new Date();

  if (!existing) {
    const [created] = await tx
      .insert(aiUsageQuota)
      .values({
        userId,
        monthlyCreditLimit: defaultLimit,
        creditsUsed: 0,
        resetAt: getNextResetDate(),
      })
      .returning();

    return created;
  }

  if (existing.resetAt.getTime() <= now.getTime()) {
    const [resetQuota] = await tx
      .update(aiUsageQuota)
      .set({
        creditsUsed: 0,
        resetAt: getNextResetDate(),
        updatedAt: now,
      })
      .where(eq(aiUsageQuota.userId, userId))
      .returning();

    return resetQuota;
  }

  return existing;
}

async function getOrCreateGuestQuotaForUpdate(tx: QuotaDbAdapter, guestId: string) {
  const [existing] = await tx
    .select()
    .from(aiGuestQuota)
    .where(eq(aiGuestQuota.guestId, guestId))
    .limit(1);

  const defaultLimit = getDefaultGuestMonthlyCredits();
  const now = new Date();

  if (!existing) {
    const [created] = await tx
      .insert(aiGuestQuota)
      .values({
        guestId,
        monthlyCreditLimit: defaultLimit,
        creditsUsed: 0,
        resetAt: getNextResetDate(),
      })
      .returning();

    return created;
  }

  if (existing.resetAt.getTime() <= now.getTime()) {
    const [resetQuota] = await tx
      .update(aiGuestQuota)
      .set({
        creditsUsed: 0,
        resetAt: getNextResetDate(),
        updatedAt: now,
      })
      .where(eq(aiGuestQuota.guestId, guestId))
      .returning();

    return resetQuota;
  }

  return existing;
}

export async function ensureAiCreditAvailable(userId: string, requiredCredits = 1) {
  return db.transaction(async (tx) => {
    const quota = await getOrCreateQuotaForUpdate(tx, userId);
    const remaining = Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed);

    return {
      allowed: remaining >= requiredCredits,
      remaining,
      used: quota.creditsUsed,
      limit: quota.monthlyCreditLimit,
      resetAt: quota.resetAt,
    };
  });
}

export async function ensureGuestAiCreditAvailable(guestId: string, requiredCredits = 1) {
  return db.transaction(async (tx) => {
    const quota = await getOrCreateGuestQuotaForUpdate(tx, guestId);
    const remaining = Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed);

    return {
      allowed: remaining >= requiredCredits,
      remaining,
      used: quota.creditsUsed,
      limit: quota.monthlyCreditLimit,
      resetAt: quota.resetAt,
    };
  });
}

export async function recordAiUsage(params: {
  userId: string;
  endpoint: string;
  model?: string;
  metadata?: Record<string, unknown>;
  credits?: number;
  usage?: UsageShape | null;
}) {
  const usageCredits =
    typeof params.credits === "number" && params.credits > 0
      ? params.credits
      : estimateAiCreditsFromUsage(params.usage);

  return db.transaction(async (tx) => {
    const quota = await getOrCreateQuotaForUpdate(tx, params.userId);
    const now = new Date();
    const remaining = Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed);
    const creditsToCharge = Math.min(Math.max(1, usageCredits), remaining);
    const overageCredits = Math.max(0, usageCredits - creditsToCharge);
    const nextUsed = quota.creditsUsed + creditsToCharge;

    if (creditsToCharge <= 0) {
      return {
        allowed: false,
        remaining,
        used: quota.creditsUsed,
        limit: quota.monthlyCreditLimit,
        resetAt: quota.resetAt,
        chargedCredits: 0,
        overageCredits,
      };
    }

    const [updated] = await tx
      .update(aiUsageQuota)
      .set({
        creditsUsed: nextUsed,
        updatedAt: now,
      })
      .where(eq(aiUsageQuota.userId, params.userId))
      .returning();

    await tx.insert(aiUsageEvent).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      endpoint: params.endpoint,
      model: params.model || null,
      creditsConsumed: creditsToCharge,
      metadata: {
        ...(params.metadata || {}),
        usage: params.usage || null,
        chargedCredits: creditsToCharge,
        estimatedCredits: usageCredits,
        overageCredits,
      },
    });

    return {
      allowed: true,
      remaining: Math.max(0, updated.monthlyCreditLimit - updated.creditsUsed),
      used: updated.creditsUsed,
      limit: updated.monthlyCreditLimit,
      resetAt: updated.resetAt,
      chargedCredits: creditsToCharge,
      overageCredits,
    };
  });
}

export async function recordGuestAiUsage(params: {
  guestId: string;
  endpoint: string;
  model?: string;
  metadata?: Record<string, unknown>;
  credits?: number;
  usage?: UsageShape | null;
}) {
  const usageCredits =
    typeof params.credits === "number" && params.credits > 0
      ? params.credits
      : estimateAiCreditsFromUsage(params.usage);

  return db.transaction(async (tx) => {
    const quota = await getOrCreateGuestQuotaForUpdate(tx, params.guestId);
    const now = new Date();
    const remaining = Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed);
    const creditsToCharge = Math.min(Math.max(1, usageCredits), remaining);
    const overageCredits = Math.max(0, usageCredits - creditsToCharge);
    const nextUsed = quota.creditsUsed + creditsToCharge;

    if (creditsToCharge <= 0) {
      return {
        allowed: false,
        remaining,
        used: quota.creditsUsed,
        limit: quota.monthlyCreditLimit,
        resetAt: quota.resetAt,
        chargedCredits: 0,
        overageCredits,
      };
    }

    const [updated] = await tx
      .update(aiGuestQuota)
      .set({
        creditsUsed: nextUsed,
        updatedAt: now,
      })
      .where(eq(aiGuestQuota.guestId, params.guestId))
      .returning();

    await tx.insert(aiUsageEvent).values({
      id: crypto.randomUUID(),
      userId: null,
      guestId: params.guestId,
      endpoint: params.endpoint,
      model: params.model || null,
      creditsConsumed: creditsToCharge,
      metadata: {
        ...(params.metadata || {}),
        usage: params.usage || null,
        chargedCredits: creditsToCharge,
        estimatedCredits: usageCredits,
        overageCredits,
      },
    });

    return {
      allowed: true,
      remaining: Math.max(0, updated.monthlyCreditLimit - updated.creditsUsed),
      used: updated.creditsUsed,
      limit: updated.monthlyCreditLimit,
      resetAt: updated.resetAt,
      chargedCredits: creditsToCharge,
      overageCredits,
    };
  });
}

export async function getAiQuotaSnapshot(userId: string) {
  const [quota] = await db
    .select()
    .from(aiUsageQuota)
    .where(eq(aiUsageQuota.userId, userId))
    .limit(1);

  const tokensPerCredit = getTokensPerCredit();

  if (!quota) {
    const defaultLimit = getDefaultMonthlyCredits();
    return {
      used: 0,
      limit: defaultLimit,
      remaining: defaultLimit,
      resetAt: getNextResetDate(),
      tokensPerCredit,
    };
  }

  const now = new Date();
  if (quota.resetAt.getTime() <= now.getTime()) {
    return {
      used: 0,
      limit: quota.monthlyCreditLimit,
      remaining: quota.monthlyCreditLimit,
      resetAt: getNextResetDate(),
      tokensPerCredit,
    };
  }

  return {
    used: quota.creditsUsed,
    limit: quota.monthlyCreditLimit,
    remaining: Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed),
    resetAt: quota.resetAt,
    tokensPerCredit,
  };
}

export async function getGuestAiQuotaSnapshot(guestId: string) {
  const [quota] = await db
    .select()
    .from(aiGuestQuota)
    .where(eq(aiGuestQuota.guestId, guestId))
    .limit(1);

  const tokensPerCredit = getTokensPerCredit();

  if (!quota) {
    const defaultLimit = getDefaultGuestMonthlyCredits();
    return {
      used: 0,
      limit: defaultLimit,
      remaining: defaultLimit,
      resetAt: getNextResetDate(),
      tokensPerCredit,
    };
  }

  const now = new Date();
  if (quota.resetAt.getTime() <= now.getTime()) {
    return {
      used: 0,
      limit: quota.monthlyCreditLimit,
      remaining: quota.monthlyCreditLimit,
      resetAt: getNextResetDate(),
      tokensPerCredit,
    };
  }

  return {
    used: quota.creditsUsed,
    limit: quota.monthlyCreditLimit,
    remaining: Math.max(0, quota.monthlyCreditLimit - quota.creditsUsed),
    resetAt: quota.resetAt,
    tokensPerCredit,
  };
}
