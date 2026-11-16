import Link from "next/link";
import { IdeaVoteBadge } from "@/components/vote-badge";
import { IdeaRowStatus } from "@/components/issue-row-status";
import { IdeaPathChips } from "@/components/idea-path";
import { LocalTime } from "@/components/local-time";
import { ideaPath, type ProjectRef } from "@/lib/project-paths";
import { SortHeader } from "@/components/sort-header";
import { DEFAULT_IDEA_SORT, IDEA_SORT_COOKIE } from "@/lib/list-sort";

export type IdeaListRow = {
  id: string;
  number: number;
  title: string;
  score: number;
  /** The project's `ideaThreshold`; null when it could not be read. */
  threshold: number | null;
  createdAt: Date;
  reporterName: string | null;
  verdicts: number;
  /** A manager agent rejected it (#idea-rejected). */
  rejected?: boolean;
  /** A manager agent archived it (#idea-archive): the reason in words, e.g. "Already implemented". */
  archived?: string | null;
  /** An agent converted it to an issue; shown when the New ideas list has no open ideas left. */
  converted?: boolean;
  /** Bad: manager agents are advised to reject it (lib/idea-rejection.ts). */
  bad?: boolean;
  /** Weighted good and bad votes (#724), shown as columns; 0 when nobody voted. */
  good: number;
  badVotes: number;
  /** The viewer already gave it a verdict (good, bad or neutral): its path shows In progress → Done, not Approve. */
  approvedByMe?: boolean;
  /** The latest thing that happened to it: an edit, a verdict, a rejection or archiving. */
  lastUpdateAt?: Date;
};

/**
 * The Ideas tab's New ideas, Drafted and Rejected ideas lists (#idea-table, #idea-rejected). Ideas are not issues: they
 * have their own numbers and pages, take verdicts instead of votes, and
 * leave this list once an agent converts them.
 *
 * Layout matches the design handoff (stitch_zedu_dashboard_ui_polish): a glass
 * card per idea with a circular score badge on the left, title + metadata in
 * the middle, and status pills + actions on the right. All original
 * functionality (voting, verdicts, path chips, navigation) is preserved.
 */
export function IdeasList({ slug, ideas, empty, welcome, filters, sort = DEFAULT_IDEA_SORT, note }: {
  slug: ProjectRef;
  ideas: IdeaListRow[];
  /** The list's sort, for the sortable column headers (#column-sort). */
  sort?: string;
  empty?: string;
  /** Shown above the list, for example when earlier ideas stand in for an empty New ideas list. */
  note?: React.ReactNode;
  /** No open ideas yet: what Ziki is for, and a box to type the first one in. */
  welcome?: React.ReactNode;
  /** The section's status filters, shown after "Status" in the header row. */
  filters?: React.ReactNode;
}) {
  if (ideas.length === 0 && welcome) return <>{welcome}</>;
  if (ideas.length === 0) {
    return (
      <div className="rounded-2xl border border-zk-border bg-zk-surface px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zk-chip text-2xl" aria-hidden>
          💡
        </div>
        <p className="text-lg font-bold text-zk-text">No ideas yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-zk-muted">
          {empty ?? "New ideas show up here until an agent converts them to issues. Be the first to share one."}
        </p>
      </div>
    );
  }
  return (
    <section className="issues-results flex flex-col gap-4" aria-label="Ideas">
      {note ? (
        <p className="m-0 flex items-start gap-2 rounded-xl border border-zk-border bg-zk-chip px-3 py-2 text-xs text-zk-text2" data-testid="ideas-list-note">
          <span aria-hidden="true" className="mt-px">ℹ️</span>
          <span>{note}</span>
        </p>
      ) : null}
      <div className="issues-table relative">
        <div>
          <div className="issues-table-heading">
            <span className="w-[52px]">
              <SortHeader label="Score" current={sort} first="score" second="score_asc" cookie={IDEA_SORT_COOKIE} />
            </span>
            <span className="min-w-0 flex-1">
              <SortHeader label="Idea" current={sort} first="title" second="title_desc" firstDescending={false} cookie={IDEA_SORT_COOKIE} />
            </span>
            <span className="hidden w-24 shrink-0 md:block">
              <SortHeader label="Last update" current={sort} first="updated" second="updated_asc" cookie={IDEA_SORT_COOKIE} />
            </span>
            <span className="issues-status-cell justify-end" style={{ width: 264, flexBasis: 264 }}>
              {filters ?? <span className="sr-only">Status</span>}
            </span>
          </div>
          <div className="space-y-4 p-3 pb-12">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                data-testid="idea-row"
                className="group relative overflow-hidden rounded-2xl border border-zk-border bg-zk-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-zk-accent/60 hover:shadow-2xl hover:shadow-zk-accent/10"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zk-accent/0 via-transparent to-zk-accent/0 opacity-0 transition-opacity duration-500 group-hover:from-zk-accent/5 group-hover:to-zk-accent/10 group-hover:opacity-100" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Left: circular score badge + title + metadata */}
                  <div className="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
                    <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-[0_0_24px_-3px_rgba(16,185,129,0.4)] ${
                      idea.score > 0
                        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent"
                        : idea.score < 0
                          ? "border-rose-500/30 bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-transparent"
                          : "border-zk-border bg-zk-chip shadow-none"
                    }`}>
                      <span className={`font-mono text-xs font-extrabold tracking-tight ${
                        idea.score > 0 ? "text-emerald-600" : idea.score < 0 ? "text-rose-600" : "text-zk-text"
                      }`}>
                        {idea.score > 0 ? `+${idea.score}` : idea.score < 0 ? `${Math.abs(idea.score)}` : idea.score}
                      </span>
                      <span className={`text-[9px] font-bold uppercase leading-none ${
                        idea.score > 0 ? "text-emerald-600" : idea.score < 0 ? "text-rose-600" : "text-zk-muted"
                      }`}>
                        votes
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-600 transition-colors group-hover:border-blue-500/40 group-hover:bg-blue-500/20">
                          Idea #{idea.number}
                        </span>
                        <Link
                          href={ideaPath(slug, idea.number)}
                          className="truncate text-base font-extrabold tracking-tight text-zk-text transition-all duration-200 hover:text-zk-accent sm:text-lg group-hover:tracking-normal"
                        >
                          {idea.title}
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zk-muted">
                        {idea.reporterName ? (
                          <span className="flex items-center space-x-1.5">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/20 text-[9px] font-bold text-indigo-700">
                              {idea.reporterName.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium text-zk-text">{idea.reporterName}</span>
                          </span>
                        ) : null}
                        <span>•</span>
                        <span>Updated {idea.lastUpdateAt ? <LocalTime date={idea.lastUpdateAt} /> : <LocalTime date={idea.createdAt} />}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-zk-text">
                          <svg className="h-3.5 w-3.5 text-zk-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                          {idea.verdicts} verdict{idea.verdicts === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Right: status pill + vote badge + path chips */}
                  <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zk-border pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                    <IdeaVoteBadge
                      ideaId={idea.id}
                      good={idea.good}
                      bad={idea.badVotes}
                      score={idea.score}
                      threshold={idea.threshold}
                      votable={!idea.rejected && !idea.archived}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zk-accent/40 bg-zk-accent/15 px-3 py-1 text-xs font-semibold text-zk-accent shadow-sm transition-all duration-200 group-hover:border-zk-accent/60 group-hover:bg-zk-accent/25 group-hover:shadow-md">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zk-accent" />
                      <IdeaRowStatus score={idea.score} threshold={idea.threshold} rejected={idea.rejected} archived={idea.archived} converted={idea.converted} bad={idea.bad} />
                    </span>
                    <IdeaPathChips ideaId={idea.id} approvedByMe={Boolean(idea.approvedByMe)} score={idea.score} threshold={idea.threshold} rejected={idea.rejected} archived={idea.archived} bad={idea.bad} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
