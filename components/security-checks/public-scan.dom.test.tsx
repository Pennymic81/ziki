// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runPublicScan } from "@/app/actions/security-preview";
import { PublicScan, SCAN_RESULT_SLOT } from "./public-scan";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/security-preview", () => ({ runPublicScan: vi.fn() }));

const summary = {
  kind: "website" as const,
  target: "settle.ng",
  checkedAt: "2026-11-15T12:00:00.000Z",
  total: 1,
  counts: { critical: 0, high: 0, medium: 1, low: 0 },
  risk: "medium" as const,
  areas: [{ area: "headers" as const, label: "Headers", problems: 1 }],
  rows: [{ severity: "medium" as const, area: "headers" as const, price: 2, label: "Headers", title: "No HSTS" }],
};

beforeEach(() => {
  // The page gives the scan's result its own place to open; the box fills it.
  const slot = document.createElement("div");
  slot.id = SCAN_RESULT_SLOT;
  document.body.appendChild(slot);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(runPublicScan).mockResolvedValue({ ok: true, summary } as never);
});

afterEach(() => {
  cleanup();
  document.getElementById(SCAN_RESULT_SLOT)?.remove();
  vi.useRealTimers();
  vi.resetAllMocks();
  push.mockReset();
});

async function scanSite(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Your URL"), "settle.ng");
  await user.keyboard("{Enter}");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
}

it("signed in, Add to your scans goes through the Security page, which asks which workspace it goes in (15 Nov call)", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<PublicScan signedIn />);
  await scanSite(user);

  await user.click(await screen.findByRole("button", { name: "Add to your scans" }));

  // The same road a new sign-up takes: never added to whichever workspace happens to be open, unasked.
  expect(push).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledWith("/security?target=settle.ng");
});

it("signed out, the site comes along through sign-up to that same Security page", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<PublicScan signedIn={false} />);
  await scanSite(user);

  const signUp = await screen.findByRole("link", { name: "Sign up" });
  expect(signUp).toHaveAttribute("href", `/signup?callbackUrl=${encodeURIComponent("/security?target=settle.ng")}`);
  expect(push).not.toHaveBeenCalled();
});
