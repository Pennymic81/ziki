import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPublicProject } from "@/lib/public-projects";
import { publicProjectPath } from "@/lib/public-project-paths";
import { PublicContributorForm } from "@/components/public-contributor-form";
import { NOINDEX } from "@/lib/seo/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Share feedback", robots: NOINDEX };

export default async function PublicContributePage({
  params,
}: {
  params: Promise<{ org: string; project: string }>;
}) {
  const { org, project: projectSlug } = await params;
  const ref = { orgSlug: org, projectSlug };
  const project = await findPublicProject(ref, { requireGuestIntake: true });
  if (!project) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <Link
          href={publicProjectPath(ref)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zk-accent hover:underline"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {project.name}
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wider text-zk-muted">Project</p>
      </div>
      <p className="mb-4 text-sm text-zk-muted">{project.goal?.split(/(?<=[.!?])\s/)[0] || `Share feedback to help improve ${project.name}.`}</p>
      <PublicContributorForm project={project} orgSlug={org} projectSlug={projectSlug} />
    </main>
  );
}
