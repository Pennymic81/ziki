import type { Prisma, SecuritySeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEVERITY_PRICE, unlockTotal } from "@/lib/security-checks";

/**
 * Unlocking fixes (#security-checks, plan C1). The scan is free; the client
 * pays per finding, by severity (SEVERITY_PRICE), all at once or the ones they
 * choose. Payment is simulated for now: unlocking only sets
 * `SecurityCheckResult.unlockedAt`. That one field shows the finding's details
 * and fix (isResultUnlocked) and lets the engine pay its finder, once. The
 * coin team replaces the inside of `payForFindings` later.
 */

export type UnlockOutcome =
  | { ok: true; unlocked: number; coins: number }
  | { ok: false; reason: "not_found" | "not_posted" | "nothing_to_unlock" };

/** What one finding costs to unlock: its stored price, or its severity's for older results. */
export function findingPrice(result: { severity: SecuritySeverity; priceCoins: number | null }): number {
  return result.priceCoins ?? SEVERITY_PRICE[result.severity];
}

/**
 * Unlock findings on the person's own check: every locked one, or only those
 * listed. Only a check whose report is posted can be unlocked, and a finding
 * already unlocked is never charged again, so a double click is safe.
 * Someone else's check, even in the same workspace, is `not_found`.
 */
export async function unlockFindings(
  checkId: string,
  organisationId: string,
  userId: string,
  which: "all" | string[],
  now = new Date(),
): Promise<UnlockOutcome> {
  const check = await prisma.securityCheck.findFirst({
    where: { id: checkId, organisationId, requestedById: userId },
    select: { postedAt: true },
  });
  if (!check) return { ok: false, reason: "not_found" };
  if (!check.postedAt) return { ok: false, reason: "not_posted" };

  const paid = await payForFindings(prisma, checkId, which, now);
  if (paid.unlocked === 0) return { ok: false, reason: "nothing_to_unlock" };
  return { ok: true, ...paid };
}

/** Simulated payment for authorized results. Both checkout flows use this operation. */
export async function payForFindings(
  db: Pick<Prisma.TransactionClient, "securityCheckResult">,
  checkId: string,
  which: "all" | string[],
  now = new Date(),
) {
  const paid = await db.securityCheckResult.updateManyAndReturn({
    where: { checkId, unlockedAt: null, ...(which === "all" ? {} : { id: { in: which } }) },
    data: { unlockedAt: now },
    select: { severity: true, priceCoins: true },
  });
  return { unlocked: paid.length, coins: unlockTotal(paid) };
}
