/**
 * Local scenario: real ideas in the Zedu and Ziki workspaces, so their Ideas
 * lists (web, mobile, desktop) show database rows instead of a welcome state
 * while the ideas-card design is worked on and shown.
 *
 *   pnpm db:scenario:zedu-ziki-ideas
 *
 * Additive only: it never resets or reseeds. Its rows have fixed ids
 * (`scn-zzi-*`), and a rerun deletes and recreates just this scenario's ideas
 * and their verdicts. It refuses to run against anything but a local database.
 *
 * The ideas are filed by alice@zendor.dev (and demo@fixtures.local gives a
 * second verdict), which `pnpm db:fixtures` creates. Each project gets five
 * ideas, every project in the two workspaces, so no Ideas list is empty.
 * The script prints each project's Ideas address.
 */
import { PrismaClient } from "@prisma/client";

const ORGANISATION_SLUGS = ["zedu", "ziki"] as const;
const ALICE_EMAIL = "alice@zendor.dev";
const SECOND_EMAIL = "demo@fixtures.local";
const P = "scn-zzi";
const IDEAS_PER_PROJECT = 5;
const BASE = "http://localhost:3001";
const MIN = 60_000;

function assertLocalDatabase(url: string | undefined): void {
  if (!url) throw new Error("DATABASE_URL is not set.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to write a scenario to a non-local database (${host}).`);
  }
}

type Seed = { title: string; description: string; score: number };

/** Five ideas per project kind; a project with any other slug gets the default five. */
const POOL: Record<string, Seed[]> = {
  web: [
    { title: "Let people export their reports as CSV", description: "Downloading a month of reports one by one takes an afternoon. A CSV export of the current list would let people take their work into a spreadsheet.", score: 4 },
    { title: "Remember the last filter on the Ideas page", description: "Every visit starts from the default filter, so people re-apply the same three choices each time. Keeping the last choice per person would save that.", score: 3 },
    { title: "Add a keyboard shortcut for search", description: "Pressing / should put the cursor in the search box, the way it does in most tools, so finding an idea does not need the mouse.", score: 2 },
    { title: "Show a clearer error when an upload is too large", description: "An oversized attachment fails with a generic message and loses the text already typed. The limit and what to do about it should be on screen.", score: 2 },
    { title: "Make the dashboard faster on slow connections", description: "On a 3G connection the dashboard takes nine seconds before anything appears. Loading the counters after the page would make it usable sooner.", score: 5 },
  ],
  mobile: [
    { title: "Keep the draft idea when the app closes", description: "Switching apps to check a screenshot throws away half a report. The draft should survive the app being closed.", score: 3 },
    { title: "Add pull-to-refresh on the Ideas page", description: "There is no way to refresh the list without leaving the tab. Pulling down should reload it.", score: 2 },
    { title: "Show upload progress on slow networks", description: "Attaching a screenshot shows a spinner with no progress, so people do not know whether it is stuck.", score: 2 },
    { title: "Open the app straight to the last project", description: "People working on one product open the same project every morning. Starting where they left off would save two taps.", score: 1 },
    { title: "Make the bottom bar reachable with one hand", description: "The primary action sits at the top of the screen and is hard to reach on a phone.", score: 4 },
  ],
  desktop: [
    { title: "Add a native notification when an idea is accepted", description: "People keep the desktop app open in the background and miss the moment an idea becomes an issue.", score: 2 },
    { title: "Remember the window size between launches", description: "The window opens at its default size every time, on top of the notes people keep beside it.", score: 1 },
    { title: "Add offline mode for reading ideas", description: "On a train the list is blank. Cached ideas and issues should still open, with writes queued until the connection returns.", score: 6 },
    { title: "Show a tray badge for work waiting on you", description: "An item that needs a verdict is invisible unless the window is open.", score: 3 },
    { title: "Let people drag a screenshot onto a report", description: "Dropping a file on the report box should attach it, the way it does in the web app.", score: 2 },
  ],
  default: [
    { title: "Let people export their reports as CSV", description: "Downloading a month of reports one by one takes an afternoon; a CSV of the current list would let people use the data elsewhere.", score: 3 },
    { title: "Remember the last filter", description: "Every visit starts from the default filter, so people re-apply the same choices each time.", score: 2 },
    { title: "Add a keyboard shortcut for search", description: "Pressing / should put the cursor in the search box, as it does in most tools.", score: 1 },
    { title: "Show a clearer error when an upload is too large", description: "An oversized attachment fails with a generic message and loses the typed text.", score: 2 },
    { title: "Make the list faster on slow connections", description: "The first screen takes nine seconds on 3G; loading counters after the page would help.", score: 4 },
  ],
};

async function main(): Promise<void> {
  assertLocalDatabase(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const alice = await prisma.user.findFirst({ where: { email: ALICE_EMAIL }, select: { id: true, name: true } });
    if (!alice) throw new Error(`${ALICE_EMAIL} does not exist here. Run pnpm db:fixtures first (it creates the local accounts).`);
    const second = await prisma.user.findFirst({ where: { email: SECOND_EMAIL }, select: { id: true } });

    const organisations = await prisma.organisation.findMany({
      where: { slug: { in: [...ORGANISATION_SLUGS] } },
      select: {
        id: true,
        slug: true,
        projects: { where: { archivedAt: null }, select: { id: true, slug: true, name: true }, orderBy: { slug: "asc" } },
      },
      orderBy: { slug: "asc" },
    });
    if (organisations.length === 0) throw new Error(`No organisation with slug ${ORGANISATION_SLUGS.join(" or ")}. Create it in the app first.`);

    const removed = await prisma.idea.deleteMany({ where: { id: { startsWith: `${P}-` } } });
    console.log(`Removed ${removed.count} earlier scenario idea(s).`);

    const now = Date.now();
    for (const organisation of organisations) {
      if (organisation.projects.length === 0) {
        console.log(`- ${organisation.slug}: no projects, skipping.`);
        continue;
      }
      for (const project of organisation.projects) {
        const seeds = POOL[project.slug] ?? POOL.default;
        for (let index = 0; index < IDEAS_PER_PROJECT; index += 1) {
          const seed = seeds[index % seeds.length];
          const id = `${P}-${organisation.slug}-${project.slug}-${index + 1}`;
          const createdAt = new Date(now - (index + 1) * 7 * MIN);
          await prisma.idea.create({
            data: {
              id,
              title: seed.title,
              description: seed.description,
              organisationId: organisation.id,
              projectId: project.id,
              reporterId: alice.id,
              beneficiaryUserId: alice.id,
              score: seed.score,
              status: "open",
              createdAt,
              updatedAt: createdAt,
              verdicts: {
                create: [
                  { id: `${id}-v-alice`, onBehalfOfUserId: alice.id, opinion: "good", votes: 1, weightClass: "working", summary: "Worth doing.", description: `I would use this: ${seed.title.toLowerCase()}.`, createdAt, updatedAt: createdAt },
                  ...(second
                    ? [{ id: `${id}-v-demo`, onBehalfOfUserId: second.id, opinion: "good" as const, votes: 1, weightClass: "working", summary: "Agreed.", description: "Same here; it saves time every week.", createdAt, updatedAt: createdAt }]
                    : []),
                ],
              },
            },
          });
        }
        console.log(`${BASE}/${organisation.slug}/${project.slug}/ideas  <- ${IDEAS_PER_PROJECT} ideas in ${project.name}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
