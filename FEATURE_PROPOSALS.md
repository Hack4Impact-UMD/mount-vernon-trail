# Feature Proposals — mount-vernon-trail

**Date:** 2026-08-06 · Companion to [PROJECT_AUDIT.md](PROJECT_AUDIT.md). Features proposed from research into the real organization's operations plus a full codebase inventory, generated through four lenses (field volunteer, event leader, admin/impact, integrations & automation) and then deduplicated, feasibility-checked, and ranked. Every "builds on" claim below was verified against the actual code.

## How to read this

These are **additive** features. The audit's fix-list is table stakes and comes first — especially wiring the photo-upload pipeline (PROJECT_AUDIT §4.1), making the trail-issue screen save (§4.3), and finishing active-event resume (§4.6). Several features below explicitly sequence after those fixes. Effort is honest sizing for this student team: *small* = days, *medium* = a sprint-ish, on top of the existing code each feature reuses.

---

## The nonprofit's workflow today

**Friends of the Mount Vernon Trail** is an all-volunteer 501(c)(3) (founded 2018) and the official Philanthropic Partner of the George Washington Memorial Parkway — the National Park Service unit that owns the 18-mile trail through Arlington, Alexandria, and Fairfax County.

- **Events:** cleanups nearly every Saturday, 9–11 AM, rotating among known sites (Jones Point Park, Four Mile Run, Fort Hunt, Rosslyn, Belle Haven, Theodore Roosevelt Island), posted ~1 month ahead. **All registration funnels through Eventbrite.** A "Trail Tuesday" series in Rosslyn is sponsored by the Rosslyn BID.
- **Leaders, not zones:** no adopt-a-section/zone program exists. The org uses trained **volunteer leaders** — 22 Weed Warriors, 4 Tree Stewards, 4 Wilderness First Aid–trained leaders — and publicly monitors volunteer-to-leader ratios. (Worth noting: the app's `zoneLeaders` field doesn't match the org's real vocabulary.)
- **Work types:** invasive removal (ivy, honeysuckle, kudzu), trash pickup, trail edging, branch/storm clearing, graffiti removal, pothole filling, trail-bump grinding, bridge/bench repairs, amenity installs (six water fountains via a $475k grant).
- **Groups:** dedicated corporate/federal/military/scout/university program; groups of 10+ email a week ahead so supplies and leader ratios can be arranged; service-hour letters signed on request.
- **Comms:** monthly newsletter, blog, Instagram/Facebook/YouTube/Bluesky, Eventbrite.
- **Impact culture:** annual report PDFs every year since 2020; headline cumulative metrics ("340+ events, 8,000+ volunteers, 20,000+ hours"); the 2024–25 NPS trail renovation ("1,000 trail bumps removed, 161 potholes fixed") won the Public Lands Alliance **2026 Trail of the Year** award.

Sources: [mountvernontrail.org](https://mountvernontrail.org/) · [events](https://mountvernontrail.org/events/) · [group volunteering](https://mountvernontrail.org/group-volunteer/) · [annual reports](https://mountvernontrail.org/about-us/annual-reports/) · [Trail of the Year coverage](https://www.alxnow.com/2026/03/02/friends-of-the-mount-vernon-trail-receive-trail-of-the-year-award-for-renovation-efforts/)

**What the app covers vs. doesn't:** the app handles the *during-event* slice well (issue documentation, before/after photos, metrics) but touches none of the surrounding workflow — signups (Eventbrite), impact reporting (annual reports are hand-aggregated), comms (recap posts are hand-written), between-event issue triage, or group/service-letter administration. That's where the leverage is.

---

## Quick wins — high impact, small effort

### 1. Publish-to-Sheets impact ledger ⭐ *(proposed independently by 3 of 4 lenses)*
**Pain:** Annual reports, NPS partner reporting, and grant applications are hand-aggregated at year-end while the app strands 18 per-event metrics in Firestore. A working Google Sheets client already sits in the repo with **zero callers**.
**Proposal:** On `publishEvent` success, append one row per event (date, title, location, hours, all metric columns, album URL) to the org's reporting spreadsheet. Generalize `createEvent` in the Sheets client from its single "improvement" column to a metrics-keyed row — `findHeaderRow` already maps arbitrary column names, so the board can reorder the sheet freely. Key rows by `trelloCardId` so republishing updates instead of duplicating.
**Builds on:** `frontend/api/googleSheetsClient.ts` (`findHeaderRow`, `colIndexToLetter`, `createEvent` — dead code needing only a caller); `publishEvent` + `extractMetricsWithHours` in `frontend/services/event-service.ts`; add the `spreadsheets` scope in the Google auth config. The highest leverage-per-line feature in this list.

### 2. Volunteer headcount and true person-hours capture
**Pain:** Volunteers-and-hours is the org's headline currency, but `extractMetricsWithHours` derives hours purely from event wall-clock duration — a 30-person and a 3-person event report identical hours, and attendance is never recorded anywhere.
**Proposal:** Add `volunteerCount` (and `youthCount` — events are kid-friendly, ages 2–85) to `EventMetrics` as stepper rows in the metrics accordion plus a required prompt in the end-event modal. Compute `personHours = headcount × duration`; show both in the summary grid and the Sheets row. Optional: a ratio chip vs. listed leaders, since the org publicly monitors leader ratios.
**Builds on:** stepper + debounced autosave in `frontend/components/ui/trail-metrics-section.tsx`; dotted `metrics.*` writes in `event-service.ts` (additive keys are safe by design); `end-event-modal.tsx`; the `METRIC_DEFS` grid in `event-summary.tsx`. Makes the app the system of record for the org's single most important grant metric.

### 3. Repeat-event templates: duplicate a past event in setup
**Pain:** Cleanups run ~90% on a recurring calendar (same 9–11 AM window, same rotating sites), yet leaders re-type title, meet-spot, leaders, and work scope from scratch every week — risking typos in the Trello naming conventions the app parses.
**Proposal:** "Duplicate a past event" in setup-event: picking a prior event prefills everything; the leader adjusts the date and taps create, which runs the existing batch write (event doc + album + Trello card). No new collection needed for v1.
**Builds on:** `frontend/app/setup-event.tsx`; `createEvent` batch write in `event-service.ts`; `TrelloClient.createCard` in `trello-funcs.ts`; `parseEventDescription` in `trello-service.ts`. Saves 10–15 min/week × ~50 events/year.

### 4. Autosave-everything field drafts (never lose typed work)
**Pain:** Two-hour outdoor events mean constant app backgrounding (camera switches, pocket-locks, cold batteries), but the notepad, setup form, and summary edits live only in component state and die with the process.
**Proposal:** One `useAutosaveDraft(screenKey, eventId, state)` hook that debounce-persists form state to AsyncStorage, restores on mount with a "Restored unsaved work" toast, and clears on successful save/publish. Apply to notepad, setup-event, and event-summary first.
**Builds on:** AsyncStorage (already a dependency, used in `albums.tsx`); the exact debounce-then-persist pattern in `trail-metrics-section.tsx`; `saveDraft` in `event-service.ts`. Complements — doesn't replace — the audit's navigation fixes.

### 5. GPS pin + nearest-landmark tag on every trail issue
**Pain:** Issues are located by free text on an 18-linear-mile trail across three jurisdictions; a scheduled crew must re-find spots documented weeks earlier by someone else. "Pothole near the bridge" fails on a trail with dozens of bridges.
**Proposal:** On issue creation, grab one `expo-location` fix, snap it to a bundled trail polyline for the nearest milepost/landmark, and append `Location: Mile 6.2 near Belle Haven` + a Google Maps link to the card description using the existing `Label: value` convention — human-readable on the board, parseable in the app.
**Builds on:** the issue-capture flows in `trail-issue-screen.tsx` / `trail-document-screen.tsx`; the desc convention parsed by `parseEventDescription`. **New:** `expo-location` dependency + a one-time OSM/GPX trail-polyline export.

### 6. Auto-label issue cards by work type
**Pain:** The org's annual reports count by work type ("1,000 trail bumps, 161 potholes"), but issue cards land in Intake as unstructured names — nobody can answer "how many open graffiti issues?" without reading every card.
**Proposal:** At issue creation the volunteer picks a work type from a chip list derived from the categories already enumerated in the metrics config; the matching Trello label is applied with one extra API call. Labels then power board filtering, per-type backlog counts, and structured `{type} @ {landmark}` naming.
**Builds on:** the authenticated fetch pattern in `trello-funcs.ts`; the category taxonomy in `event-summary.tsx` `METRIC_DEFS`; the `trail-issue-screen.tsx` form. One dropdown buys structured data for every downstream feature here.

---

## Core investments — high impact, medium effort

### 7. Field Sync Queue: offline-first capture with pending badge
**Pain:** Every Saturday happens in spotty-coverage riverside terrain, but every capture is a live network call — a failed request mid-trail silently loses the tally or issue photo. Open issue #51 (slow issue pages) is a symptom of the same always-online design.
**Proposal:** A thin AsyncStorage-backed write queue: capture actions (create issue card, attach photo, metric delta, note edit) append to the queue and apply optimistically to local UI; a flusher drains on foreground/connectivity regain, replaying Trello + Firestore calls in order. "N pending sync" badge in the header. Scope v1 strictly to the three field actions — not full offline browsing.
**Builds on:** `updateEventMetrics`'s incremental dotted-delta writes (queue-friendly by design); replay targets in `trello-funcs.ts`/`trello-service.ts`; `components/ui/header.tsx` for the badge. Build after the autosave hook — shared persistence plumbing. Also the durable fix behind issues #51/#88.

### 8. Shareable impact recap card on publish ⭐ *(3 of 4 lenses)*
**Pain:** The org actively runs four social channels and a monthly newsletter, and every Saturday ends with real numbers and before/after photos — yet metrics die in Firestore and someone hand-writes every recap post. Volunteers walk away with nothing to share, wasting the org's cheapest recruiting channel.
**Proposal:** After publish, render a branded square card — title, date, location, the nonzero-metric icon grid, optionally the before/after composite — snapshot with `captureRef`, and hand to the native share sheet with an auto-caption ("12 volunteers, 9 bags of trash at Jones Point Park — photos: {albumUrl}"). One asset serves volunteers' feeds, the comms person, and the newsletter.
**Builds on:** the working `captureRef` + media-library pipeline in `before-after-graphic.tsx` (reused wholesale); `METRIC_DEFS`/`MetricGridCard` in `event-summary.tsx`; `publish-event-modal.tsx`; `Event.albumUrl`. Sharing via RN's built-in `Share` API (or add `expo-sharing`).

### 9. Cumulative Impact dashboard (season / all-time rollup)
**Pain:** The president's letter, award applications, and fundraising appeals all need cumulative and YTD totals, but the app has no aggregate view — the past-events section is a placeholder, and an admin would have to open every event one at a time.
**Proposal:** An admin-gated Impact screen that queries published events, sums metrics client-side (~50 events/year — trivial), and renders totals with the existing animated metric grid extracted into a shared component. Year filter + a hero row mirroring the annual-report headline format ("X events, Y volunteers, Z hours"). Screenshot-friendly = board-meeting slide.
**Builds on:** extract `METRIC_DEFS` + `MetricGridCard` from `event-summary.tsx`; `extractMetricsWithHours`; `hooks/use-is-admin.ts`; `bottom-nav.tsx`. Fills the past-events placeholder gap; best after headcount (feature 2) so volunteer totals are real.

### 10. One-tap hazard report (works outside an active event)
**Pain:** Storm cleanup and downed trees are documented org work, and the Trello board has a dedicated Intake list — but the app only documents issues *inside an active event*. A leader riding the trail on a Wednesday has no fast path; the hazard waits on an email.
**Proposal:** A "Report a hazard" home-screen button available any time signed in: existing camera, one photo, a 5-chip category row (downed tree / flooding / pothole / graffiti / other), auto GPS line, creating a card directly in Intake with the photo as cover. Three taps, one-handed. Integrates with the sync queue if built; shippable standalone.
**Builds on:** `camera-view.tsx`; the Intake list constant + `createCard` with attachments in `trello-service.ts`/`trello-funcs.ts`; `use-trello-auth.ts`; the home-screen button row. Compose with features 5 and 6 for maximum effect.

### 11. Eventbrite registration count on upcoming event cards
**Pain:** All registration funnels through Eventbrite and the org explicitly manages volunteer-to-leader ratios — but the app's upcoming events know nothing about registration, so leaders juggle the Eventbrite dashboard to decide whether Saturday needs 2 leaders or 5.
**Proposal:** Store an Eventbrite event ID on the Event doc at setup; add a backend route behind the existing `x-api-key` middleware proxying the Eventbrite attendee-count API; `upcoming-events-card` shows "NN registered" with a ratio warning badge. Read-only — registration stays on Eventbrite.
**Builds on:** the Express app + auth middleware in `backend/src/index.ts`; the Event model; `upcoming-events-card.tsx`. **Caveat:** needs the org's Eventbrite token and a deployed backend — coordinate with the photo-upload wiring (audit §4.1), which needs the same deployment.

---

## Nice to have

### 12. Aging-issue visibility: oldest-first sort, age badges, weekly digest
Issues can silently sit in Intake for months. Phase 1 (small, no backend): sort the in-app issues list oldest-first with an age badge from the already-modeled `creationDate` (`trello-types.ts`, mapped in `trello-service.ts`). Phase 2: a cron-hit backend endpoint that labels 30d+ cards "Aging" and emails leaders a weekly digest. Ship phase 1 alone as a near-quick-win.

### 13. Escalate-to-NPS flag on trail issues
NPS-scale issues (structural damage, washouts) sit in the same list as litter — and publish bulk-moves *every* attached issue card to Completed (`moveCardAttachmentsToCompleted`, `Promise.allSettled` in `trello-service.ts`), so a big issue can be silently marked done. Add an "Escalate to NPS" action: Trello label + comment, exclusion from the publish move, and a prefilled mailto to the parkway contact. Complements (doesn't duplicate) open issue #67. Get the real NPS contact from the org first.

### 14. Group-event tagging with service-hours letter
The org's group program (corporate/scout/university, 10+ email ahead) and signed service-hour letters are all manual today. Optional `groupName`/`groupHeadcount` in setup-event, written to the card desc via the existing `Label: value` convention; event summary gains "Generate service letter" via the share sheet. Also the right home for the per-volunteer-hours value of the killed "impact passport" idea — leader-generated letters need no volunteer app adoption.

### 15. Leader morning-of reminders (local notifications)
Correct hours and live metrics depend on the leader opening the app at 9 AM. Schedule local notifications from `fetchUpcomingEvents` data: a prep nudge the evening before and an 8:45 AM "tap to begin tracking" deep link into `startEvent`. **New dep:** `expo-notifications`. Sequenced behind the active-event resume fix (audit §4.6).

### 16. Field mode: oversized steppers + haptic ticks
Everyone wears work gloves (the Event model literally has a `gloverLover` role), but the metric steppers are standard-size targets requiring eyes-on confirmation. A "Field mode" toggle: ~64pt high-contrast steppers, each increment fires a haptic tick (`expo-haptics` already installed). Zero new dependencies; the surviving cheap half of a cut voice-notes idea.

### 17. Tool and supply manifest as a Trello checklist
Tool load-out (loppers for ivy, grabbers for trash) is a real weekly planning task living in texts and memory, while the Event model names `toolHaulers` with nothing to haul. Generate an editable supply checklist from `workScope` keywords scaled by headcount, written to the event card as a native Trello checklist. Validate the keyword→tools mapping with real leaders first; stronger once feature 11 provides headcount.

### 18. Weather strip on upcoming events (NWS forecast)
Fetch api.weather.gov (free, keyless) for each event's date/window and render precipitation/temp/wind with a green-yellow-red flag on `upcoming-events-card.tsx`. Small effort, but convenience-grade impact — leaders already have weather apps. The original "postpone" action was cut because renaming Trello cards breaks the `{date} {title}` convention downstream parsers rely on.

### 19. Leader roster with certifications and recognition stats
The annual report counts leaders by certification (22 Weed Warriors, 4 Tree Stewards…), but the app stores leaders as free text — "Judd", "Judd I.", and "Judd Isbell" are three people. A small `leaders` collection behind an autocomplete picker (still writing the same display strings to Trello), plus a leaders panel on the Impact dashboard. Quietly lays identity groundwork for per-user scoping (audit §3.6, issue #73) without being that fix itself.

### 20. Issue-resolution turnaround stats
The org's strongest story beyond totals is responsiveness ("issues fixed in a median of N days"). The data half-exists — cards carry `creationDate` and publish is the resolution moment — but the timestamp is thrown away. Write a `resolvedIssues` record per moved card at publish; surface median/max days-open on the Impact dashboard. Small capture write — bundle into the dashboard milestone (feature 9).

---

## Ideas considered and dropped

- **Per-volunteer "My Impact" passport with exportable service hours** — assumes broad volunteer app adoption the org doesn't have (signup lives on Eventbrite; the app is leader-operated). Its reporting value is captured far more cheaply by headcount capture (2) + the group service letter (14).
- **Add-to-calendar for scheduled events** — Eventbrite, the org's sole registration funnel, already sends calendar invites with confirmations; a new `expo-calendar` dependency for marginal duplicate value.
- **Duplicate-issue check at report time** — premature at current Intake volume; auto-labels (6) plus `{type} @ {landmark}` naming (5) deliver most of the dedupe benefit for free.
- **Glove-mode voice notes** — on-device speech-to-text is a community-package dependency and heavy for a student team; the sizing + haptics half survives as feature 16.
- **Weather-based postpone action** — renaming Trello cards touches the `{MM/DD/YYYY} {title}` convention every downstream parser relies on; the forecast strip survives standalone as feature 18.

---

## Suggested sequencing

1. **First, audit table stakes:** photo pipeline wiring, trail-issue save, active-event resume (PROJECT_AUDIT §4).
2. **Then the metrics spine:** headcount (2) → Sheets ledger (1) → Impact dashboard (9) — three small-to-medium steps that turn the app into the org's reporting system of record.
3. **Field reliability:** autosave (4) → sync queue (7).
4. **Issue quality:** auto-labels (6) + GPS pins (5) → hazard report (10).
5. Everything else as capacity allows.
