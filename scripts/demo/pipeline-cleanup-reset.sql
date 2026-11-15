-- Pipeline cleanup demo: RESET. Puts the 11 demo Desktop issues back to how
-- they started (open, rejected or duplicated with dates moved back), so the
-- cleanup can be shown closing them again. Keeps the demo logins.
--
-- Run it in the Neon SQL Editor AFTER setting PIPELINE_CLEANUP=dry_run on
-- Render (and waiting for the deploy to be Live); otherwise the cleanup
-- closes them again within a minute. Issue numbers continue from the last
-- one (the old demo issues are deleted with their votes and history).

DO $$
DECLARE
  org  text := 'tenant_zedu';
  proj text;
BEGIN
  SELECT id INTO proj FROM "Project" WHERE "organisationId" = org AND slug = 'desktop';
  IF proj IS NULL OR NOT EXISTS (SELECT 1 FROM "User" WHERE id = 'demo_michael') THEN
    RAISE NOTICE 'Demo data not found; nothing reset.';
    RETURN;
  END IF;

  DELETE FROM "Bug" WHERE id LIKE 'demo\_b%';

  INSERT INTO "Bug" (id, title, description, "reporterId", "beneficiaryUserId", "organisationId", "projectId",
                     status, substatus, "assigneeId", "duplicateOfId", "closeReason", "closedAt", "createdAt", "updatedAt") VALUES
    ('demo_b101', 'Desktop: window doesn''t remember its maximized state', 'Restart the app after maximizing: it opens at the default size.', 'demo_t1', 'demo_t1', org, proj, 'open', 'open', NULL, NULL, NULL, NULL, now() - interval '10 days', now() - interval '10 days'),
    ('demo_b102', 'Desktop: maximized window opens small again after restart', 'Same as the maximized-state report.', 'demo_t2', 'demo_t2', org, proj, 'open', 'open', NULL, 'demo_b101', NULL, NULL, now() - interval '6 days', now() - interval '3 days'),
    ('demo_b103', 'Emoji picker doesn''t replace highlighted text in the DM composer', 'Select text, pick an emoji: the emoji is added after the text instead of replacing it.', 'demo_t3', 'demo_t3', org, proj, 'open', 'open', NULL, NULL, NULL, NULL, now() - interval '9 days', now() - interval '9 days'),
    ('demo_b104', 'Emoji insert ignores the selected text', 'Looks like the emoji picker report.', 'demo_t4', 'demo_t4', org, proj, 'open', 'open', NULL, 'demo_b103', NULL, NULL, now() - interval '2 days', now() - interval '1 day'),
    ('demo_b105', 'Settings modal doesn''t close when pressing Escape', 'Press Escape with Settings open: nothing happens.', 'demo_t1', 'demo_t1', org, proj, 'open', 'requires_confirmation', NULL, NULL, NULL, NULL, now() - interval '8 days', now() - interval '4 days'),
    ('demo_b106', 'Footer Facebook icon links to a broken URL', 'The Facebook link in the footer opens a 404.', 'demo_t2', 'demo_t2', org, proj, 'open', 'open', NULL, NULL, NULL, NULL, now() - interval '8 days', now() - interval '5 days'),
    ('demo_b107', 'Print preview doesn''t match the screen layout', 'Printing a channel shows a different layout.', 'demo_t3', 'demo_t3', org, proj, 'open', 'open', NULL, NULL, NULL, NULL, now() - interval '3 days', now() - interval '1 day'),
    ('demo_b108', 'Clipboard paste doesn''t work in text fields', 'Ctrl+V does nothing in the search box.', 'demo_t4', 'demo_t4', org, proj, 'in_progress', 'in_progress', 'demo_t2', NULL, NULL, NULL, now() - interval '9 days', now() - interval '5 days'),
    ('demo_b109', 'Voice note keeps the send button disabled', 'After recording, send stays greyed out.', 'demo_t1', 'demo_t1', org, proj, 'closed', 'closed', NULL, NULL, 'already_implemented', now() - interval '6 days', now() - interval '12 days', now() - interval '6 days'),
    ('demo_b110', 'Drag handle isn''t visible on resizable panels', 'There is no visible handle to resize the side panel.', 'demo_t2', 'demo_t2', org, proj, 'open', 'open', NULL, NULL, NULL, NULL, now() - interval '9 days', now() - interval '6 days'),
    ('demo_b111', 'Window size resets on relaunch', 'Same problem as the maximized-state report.', 'demo_t3', 'demo_t3', org, proj, 'open', 'open', NULL, 'demo_b101', NULL, NULL, now() - interval '4 days', now() - interval '60 hours');

  -- Confirmation votes (live, not undone).
  INSERT INTO "IssueConfirmation" (id, "bugId", "onBehalfOfUserId", verdict, summary, description, "createdAt", "updatedAt") VALUES
    ('demo_c105a', 'demo_b105', 'demo_t1', 'reject',  'Escape already closes it', 'Works on the current build.', now() - interval '6 days', now() - interval '6 days'),
    ('demo_c105b', 'demo_b105', 'demo_t2', 'reject',  'Can''t reproduce', 'Escape closes the modal for me.', now() - interval '5 days', now() - interval '5 days'),
    ('demo_c105c', 'demo_b105', 'demo_t3', 'reject',  'Not a bug', 'Closes on Escape.', now() - interval '4 days', now() - interval '4 days'),
    ('demo_c105d', 'demo_b105', 'demo_t4', 'confirm', 'Happens once', 'Saw it once after a reload.', now() - interval '7 days', now() - interval '7 days'),
    ('demo_c106a', 'demo_b106', 'demo_t1', 'reject',  'Link looks fine', 'Opened for me.', now() - interval '6 days', now() - interval '6 days'),
    ('demo_c106b', 'demo_b106', 'demo_t2', 'confirm', 'Broken', '404 page.', now() - interval '6 days', now() - interval '6 days'),
    ('demo_c106c', 'demo_b106', 'demo_t3', 'confirm', 'Broken', '404 page.', now() - interval '5 days', now() - interval '5 days'),
    ('demo_c106d', 'demo_b106', 'demo_t4', 'confirm', 'Broken', '404 page.', now() - interval '5 days', now() - interval '5 days'),
    ('demo_c106e', 'demo_b106', 'demo_michael', 'confirm', 'Broken', '404 page.', now() - interval '5 days', now() - interval '5 days'),
    ('demo_c107a', 'demo_b107', 'demo_t1', 'reject',  'Expected', 'Print uses its own layout on purpose.', now() - interval '2 days', now() - interval '2 days'),
    ('demo_c107b', 'demo_b107', 'demo_t2', 'reject',  'Not a bug', 'Print layout is intended.', now() - interval '1 day', now() - interval '1 day'),
    ('demo_c108a', 'demo_b108', 'demo_t1', 'reject',  'Can''t reproduce', 'Paste works.', now() - interval '7 days', now() - interval '7 days'),
    ('demo_c108b', 'demo_b108', 'demo_t3', 'reject',  'Can''t reproduce', 'Paste works.', now() - interval '6 days', now() - interval '6 days'),
    ('demo_c108c', 'demo_b108', 'demo_t4', 'reject',  'Can''t reproduce', 'Paste works.', now() - interval '5 days', now() - interval '5 days'),
    ('demo_c108d', 'demo_b108', 'demo_t2', 'confirm', 'Happens', 'Paste fails in search.', now() - interval '8 days', now() - interval '8 days'),
    ('demo_c110a', 'demo_b110', 'demo_t1', 'reject',  'Handle is there', 'It shows on hover.', now() - interval '7 days', now() - interval '7 days'),
    ('demo_c110b', 'demo_b110', 'demo_t2', 'reject',  'Handle is there', 'It shows on hover.', now() - interval '7 days', now() - interval '7 days'),
    ('demo_c110c', 'demo_b110', 'demo_t3', 'confirm', 'Not visible', 'No handle until you hover.', now() - interval '6 days', now() - interval '6 days'),
    ('demo_c110d', 'demo_b110', 'demo_t4', 'confirm', 'Not visible', 'Hard to find.', now() - interval '6 days', now() - interval '6 days');

  -- When each duplicate was marked (what the 2-day rule counts from).
  INSERT INTO "BugActivity" (id, "bugId", "actorId", type, summary, metadata, "createdAt") VALUES
    ('demo_a102', 'demo_b102', 'demo_mark', 'duplicate_changed', 'marked this as a duplicate of #' || (SELECT number FROM "Bug" WHERE id = 'demo_b101'), '{"field":"duplicateOf","from":null,"to":"demo_b101"}', now() - interval '3 days'),
    ('demo_a104', 'demo_b104', 'demo_mark', 'duplicate_changed', 'marked this as a duplicate of #' || (SELECT number FROM "Bug" WHERE id = 'demo_b103'), '{"field":"duplicateOf","from":null,"to":"demo_b103"}', now() - interval '1 day'),
    ('demo_a111', 'demo_b111', 'demo_mark', 'duplicate_changed', 'marked this as a duplicate of #' || (SELECT number FROM "Bug" WHERE id = 'demo_b101'), '{"field":"duplicateOf","from":null,"to":"demo_b101"}', now() - interval '60 hours');

  RAISE NOTICE 'Pipeline demo issues reset.';
END $$;
