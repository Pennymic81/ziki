import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findPublicProject } from "@/lib/public-projects";
import type { PublicProjectRef } from "@/lib/public-project-paths";

export type PublicIssueStatusFilter = "all" | "open" | "in_progress" | "resolved";

export type PublicIssueSummary = {
  id: string;
  number: number;
  title: string;
  summary: string | null;
  status: string;
  substatus: string;
  createdAt: Date;
  updatedAt: Date;
  area: { name: string } | null;
};

export type PublicIssueDetail = PublicIssueSummary & {
  description: string | null;
};

const PUBLIC_ISSUE_SELECT = {
  id: true,
  number: true,
  title: true,
  summary: true,
  status: true,
  substatus: true,
  createdAt: true,
  updatedAt: true,
  area: { select: { name: true } },
} satisfies Prisma.BugSelect;

export function parsePublicIssueStatus(value?: string | null): PublicIssueStatusFilter {
  if (value === "open" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return "all";
}

export async function listPublicIssues(
  ref: PublicProjectRef,
  options: { query?: string; status?: PublicIssueStatusFilter } = {},
) {
  const project = await findPublicProject(ref);
  if (!project) return null;

  const status = options.status ?? "all";
  const query = (options.query ?? "").trim();

  const where: Prisma.BugWhereInput = {
    projectId: project.id,
    isDeleted: false,
    securityFinding: { is: null },
    status:
      status === "all"
        ? { in: ["open", "in_progress", "done", "merge", "resolved"] }
        : status,
  };

  if (query) {
    const parsedNumber = /^#?(\d+)$/.exec(query);
    if (parsedNumber) {
      where.OR = [
        { number: Number.parseInt(parsedNumber[1] ?? "0", 10) },
        { title: { contains: query, mode: "insensitive" } },
      ];
    } else {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  const issues = await prisma.bug.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { number: "desc" }],
    take: 50,
    select: PUBLIC_ISSUE_SELECT,
  });

  return { project, issues };
}

export async function findPublicIssue(ref: PublicProjectRef, issueNumber: number) {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) return null;
  const project = await findPublicProject(ref);
  if (!project) return null;

  const issue = await prisma.bug.findFirst({
    where: {
      projectId: project.id,
      number: issueNumber,
      isDeleted: false,
      securityFinding: { is: null },
    },
    select: {
      ...PUBLIC_ISSUE_SELECT,
      description: true,
    },
  });

  if (!issue) return null;
  return { project, issue };
}
