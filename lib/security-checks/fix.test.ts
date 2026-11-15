import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/agent-api/idea-verdicts", () => ({ convertClientVettedIdea: vi.fn() }));

import { convertClientVettedIdea } from "@/lib/agent-api/idea-verdicts";
import { PLACEHOLDER_DESCRIPTION, PLACEHOLDER_SUMMARY } from "@/lib/security-findings";
import { listFixProjects, loadMovePage, sendCheckFindings } from "./fix";

const client = { userId: "u1", organisationId: "o1", superAdmin: false };
const selection = { checkId: "c1", projectId: "p1", resultIds: ["r1"] };

const tx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  project: { findFirst: vi.fn() },
  securityCheck: { update: vi.fn() },
  securityCheckResult: { findMany: vi.fn(), update: vi.fn(), updateManyAndReturn: vi.fn() },
  idea: { create: vi.fn() },
  securityFinding: { create: vi.fn() },
};
const db = { $transaction: vi.fn((work: (client: typeof tx) => unknown) => work(tx)) };
const send = (input = selection) => sendCheckFindings(client, input, db as never);

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ postedAt: new Date(), projectId: null }]);
  tx.$executeRaw.mockResolvedValue(1);
  tx.project.findFirst.mockResolvedValue({ slug: "web", organisation: { slug: "ziki" } });
  tx.securityCheckResult.findMany.mockResolvedValue([{ id: "r1", severity: "high", unlockedAt: new Date(), finding: null }]);
  tx.securityCheckResult.updateManyAndReturn.mockResolvedValue([]);
  tx.idea.create.mockResolvedValue({ id: "i1" });
  tx.securityFinding.create.mockResolvedValue({ id: "f1" });
  vi.mocked(convertClientVettedIdea).mockResolvedValue({ issueNumber: 42 } as never);
});

describe("Fix on Ziki", () => {
  it("totals only newly unlocked results in a mixed selection", async () => {
    tx.securityCheckResult.findMany.mockResolvedValue([
      { id: "r1", severity: "high", unlockedAt: null, finding: null },
      { id: "r2", severity: "low", unlockedAt: new Date(), finding: null },
    ]);
    tx.securityCheckResult.updateManyAndReturn.mockResolvedValue([{ severity: "high", priceCoins: 7 }]);

    await expect(send({ ...selection, resultIds: ["r1", "r2"] })).resolves.toMatchObject({
      ok: true, created: 2, coins: 7,
    });
    expect(tx.securityCheckResult.updateManyAndReturn).toHaveBeenCalledWith({
      where: { checkId: "c1", id: { in: ["r1", "r2"] }, unlockedAt: null },
      data: { unlockedAt: expect.any(Date) },
      select: { severity: true, priceCoins: true },
    });
  });

  it("does not load another person's check in the same workspace", async () => {
    const otherCheck = { id: "c1", organisationId: "o1", requestedById: "u2" };
    const lookup = {
      securityCheck: { findFirst: vi.fn(({ where }) =>
        Object.entries(where).every(([key, value]) => otherCheck[key as keyof typeof otherCheck] === value)
          ? { postedAt: new Date(), target: { value: "example.test" } } : null,
      ) },
      securityCheckResult: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(loadMovePage(client, "c1", lookup as never)).resolves.toBeNull();
    expect(lookup.securityCheckResult.findMany).not.toHaveBeenCalled();
    await expect(loadMovePage({ ...client, userId: "u2" }, "c1", lookup as never)).resolves.toMatchObject({ posted: true });
  });

  it("offers projects for a posted report", async () => {
    const lookup = {
      securityCheck: { findFirst: vi.fn().mockResolvedValue({ postedAt: new Date(), projectId: null }) },
      project: { findMany: vi.fn().mockResolvedValue([{ id: "p1", name: "Web" }]) },
    };
    await expect(listFixProjects(client, "c1", lookup as never)).resolves.toEqual({
      projectId: null, projects: [{ id: "p1", name: "Web" }],
    });
    expect(lookup.securityCheck.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "c1", requestedById: "u1", organisationId: "o1" },
    }));
  });

  it("rejects a check before its report is posted", async () => {
    tx.$queryRaw.mockResolvedValue([{ postedAt: null, projectId: null }]);
    await expect(send()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("posted") });
    expect(tx.project.findFirst).not.toHaveBeenCalled();
    expect(tx.securityCheckResult.findMany).not.toHaveBeenCalled();
    expect(tx.idea.create).not.toHaveBeenCalled();
  });

  it("does not list projects before the report is posted", async () => {
    const lookup = {
      securityCheck: { findFirst: vi.fn().mockResolvedValue({ postedAt: null, projectId: null }) },
      project: { findMany: vi.fn() },
    };
    await expect(listFixProjects(client, "c1", lookup as never)).resolves.toBeNull();
    expect(lookup.project.findMany).not.toHaveBeenCalled();
  });

  it("scopes the locked check to the requester and workspace", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(send()).resolves.toMatchObject({ ok: false });
    const [sql, ...params] = tx.$queryRaw.mock.calls[0];
    expect(sql.join(" ")).toContain('AND "requestedById"');
    expect(sql.join(" ")).toContain("FOR NO KEY UPDATE");
    expect(params).toEqual(["c1", "o1", "u1"]);
    expect(tx.project.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a destination outside the workspace or without access", async () => {
    tx.project.findFirst.mockResolvedValue(null);
    await expect(send()).resolves.toMatchObject({ ok: false });
    expect(tx.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "p1", organisationId: "o1", archivedAt: null,
        organisation: { archivedAt: null, memberships: { some: { userId: "u1" } } },
      },
    }));
    expect(tx.idea.create).not.toHaveBeenCalled();
  });

  it("rejects a mixed batch with unrelated results before making any writes", async () => {
    await expect(send({ ...selection, resultIds: ["r1", "other-check-result"] })).resolves.toMatchObject({ ok: false });
    expect(tx.securityCheckResult.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { checkId: "c1", id: { in: ["r1", "other-check-result"] } },
    }));
    expect(tx.idea.create).not.toHaveBeenCalled();
    expect(tx.securityCheck.update).not.toHaveBeenCalled();
  });

  it("keeps the first destination on subsequent submissions", async () => {
    tx.$queryRaw.mockResolvedValue([{ postedAt: new Date(), projectId: "p2" }]);
    await expect(send()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("already has a destination") });
    expect(tx.idea.create).not.toHaveBeenCalled();
  });

  it("uses placeholders on the idea and reuses the result link on repeat submissions", async () => {
    await expect(send({ ...selection, resultIds: ["r1", "r1"] })).resolves.toEqual({
      ok: true, created: 1, reused: 0, coins: 0, issues: [{ resultId: "r1", number: 42, href: "/ziki/web/42" }],
    });
    expect(tx.idea.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: "Private security finding (High)", summary: PLACEHOLDER_SUMMARY, description: PLACEHOLDER_DESCRIPTION,
      }),
    }));
    expect(tx.$executeRaw.mock.calls[0].slice(1)).toEqual(["f1", "r1", "c1"]);
    expect(convertClientVettedIdea).toHaveBeenCalledWith(tx, { organisationId: "o1", projectId: "p1" }, "i1", "u1");
    expect(tx.securityCheckResult.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { findingId: "f1" } });
    expect(tx.securityCheck.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { projectId: "p1" } });

    tx.$queryRaw.mockResolvedValue([{ postedAt: new Date(), projectId: "p1" }]);
    tx.securityCheckResult.findMany.mockResolvedValue([{ id: "r1", severity: "high", unlockedAt: new Date(), finding: { bug: { number: 42 } } }]);
    await expect(send()).resolves.toEqual({ ok: true, created: 0, reused: 1, coins: 0, issues: [{ resultId: "r1", number: 42, href: "/ziki/web/42" }] });
    expect(tx.idea.create).toHaveBeenCalledTimes(1);
    expect(tx.securityFinding.create).toHaveBeenCalledTimes(1);
    expect(convertClientVettedIdea).toHaveBeenCalledTimes(1);
  });

  it("propagates conversion failure so the transaction rolls back", async () => {
    vi.mocked(convertClientVettedIdea).mockRejectedValueOnce(new Error("Conversion failed"));
    await expect(send()).rejects.toThrow("Conversion failed");
    expect(tx.securityCheckResult.update).not.toHaveBeenCalled();
    expect(tx.securityCheck.update).not.toHaveBeenCalled();
  });
});
