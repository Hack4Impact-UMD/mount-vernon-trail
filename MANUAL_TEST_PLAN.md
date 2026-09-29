# Manual test plan

Covers the flows that need real Google, Trello, and Firebase credentials and so
cannot be driven headlessly. Everything marked **[auto]** already has automated
coverage and is listed only for context.

## Preconditions

1. `frontend/.env` and `backend/.env` are filled in (see each `.env.example`).
2. Firestore indexes and rules are deployed:
   ```bash
   firebase deploy --only firestore:indexes   # wait until all indexes are READY
   firebase deploy --only firestore:rules
   ```
3. The backend is running and reachable from the device:
   ```bash
   cd backend && npm run dev
   ```
   `EXPO_PUBLIC_BACKEND_URL` must point at it — `http://localhost:8080` for the
   iOS simulator, `http://10.0.2.2:8080` for the Android emulator, or your
   machine's LAN IP for a physical device.
4. Your account holds the `admin` claim:
   ```bash
   cd backend && npm run set-admin -- you@example.com
   ```
   **Sign out and back in afterwards** — ID tokens cache the claim for up to an hour.
5. The MVT Google account is linked once per environment (see `backend/README.md`).
   Confirm with `GET /api/auth/status` → `{"authenticated":true}`.

---

## 1. Sign-in

| # | Step | Expected |
|---|---|---|
| 1.1 | Launch the app signed out | Google sign-in screen; no red box |
| 1.2 | Tap Sign in with Google, complete consent | Lands on the home screen |
| 1.3 | Check the consent screen's requested scopes | **Only** name, email, profile. No Google Photos, no Sheets |
| 1.4 | Cancel the Google sheet mid-flow | "Sign-in Cancelled", app stays usable |
| 1.5 | Force-quit and relaunch | Still signed in (auth persistence) |
| 1.6 | Profile → Sign Out | Returns to the sign-in screen |

**1.3 is the regression check** for dropping the `photoslibrary.*` and
`spreadsheets` scopes.

## 2. Trello sign-in

| # | Step | Expected |
|---|---|---|
| 2.1 | On the home screen while not Trello-authorized | Trello login gate appears |
| 2.2 | Authorize | Home screen with upcoming events from the configured board |
| 2.3 | Confirm which board was read | The board named by `EXPO_PUBLIC_TRELLO_BOARD_NAME` (default: MVT Mock Board) |

## 3. Admin event creation

| # | Step | Expected |
|---|---|---|
| 3.1 | Home screen as a **non-admin** | "Create New Event" is **not** shown |
| 3.2 | Home screen as an **admin** | "Create New Event" is shown |
| 3.3 | Create with a title and date but **no** zone leaders / tool haulers / glover lover | Succeeds — these are optional now |
| 3.4 | Create with no event leader | Blocked: "Event leader is required." |
| 3.5 | Complete a creation | Google Photos album created **in the MVT account**, Trello card in Scheduled Events, album link appended to the card description |
| 3.6 | Create a second event with the **same title** | Blocked: "An album named … already exists." |
| 3.7 | Same title differing only in case ("Spring Cleanup" vs "spring cleanup") | Also blocked |
| 3.8 | Tap Cancel with no back history | Buttons do not stay stuck in a spinner |
| 3.9 | Inspect the Cancel button on a real device | Its border is visible (was web-only `outlineWidth`) |

**3.6/3.7 are the regression check** for the album-title clobbering bug.
**3.5**: verify the album appears in the **MVT** account, not your personal library.

### 3b. Rollback (requires induced failure)

| # | Step | Expected |
|---|---|---|
| 3.10 | Set an invalid Trello list name in env, then create an event | Fails with a clear message; **no** orphaned album record is left blocking the title |
| 3.11 | Fix the env and retry with the same title | Succeeds, reusing the album created in 3.10 rather than making a duplicate |

## 4. Running an event

| # | Step | Expected |
|---|---|---|
| 4.1 | Tap an upcoming event | Modal shows leader / zone leaders / tool haulers / work scope |
| 4.2 | Start Event | Navigates to the trail document screen |
| 4.3 | Sign in as a **different** user on another device | That user does **not** see this event as active and cannot end it |
| 4.4 | Force-quit mid-event and relaunch | Prompted: "Event still running … Resume?" |
| 4.5 | Tap Resume | Returns to the trail document screen for that event |

**4.3 is the regression check** for the unscoped `getActiveEvent`.

## 5. Documenting an issue and the photo pipeline

This is the flow the whole project exists for.

| # | Step | Expected |
|---|---|---|
| 5.1 | Tap anywhere on a trail issue card (not just the chevron) | Opens the issue |
| 5.2 | Type notes, tap Save notes | Persists; reopening the issue shows them; the Trello card description gains a "📝 Field Notes" section |
| 5.3 | Tap the Before photo, take a picture, tap DONE | Returns to the **issue screen** (not a second document screen); the photo shows with "Waiting to upload" or "Uploaded" |
| 5.4 | Go back to the document screen | The notepad text you typed earlier is **still there** |
| 5.5 | Tap the After photo | Camera opens in after mode with the before photo as a ghost overlay, and the slider adjusts it |
| 5.6 | Check the thumbnail label in after mode | Reads "After", not "Before" |
| 5.7 | Deny photo-library permission, then tap DONE | An alert explains the photo will not be in the camera roll, and DONE **still works** |
| 5.8 | Take several photos across issues | The camera roll has **one** "mount-vernon-trail" album, not one per photo |
| 5.9 | Put the device in airplane mode, take a photo, tap DONE | Photo is queued; banner reads "N photos waiting to upload" |
| 5.10 | Restore connectivity, tap "Upload now" | Photos upload; status flips to Uploaded |
| 5.11 | Force-quit with photos queued, relaunch, reopen the event | Queued photos are **still there** |
| 5.12 | Open the event's album in Google Photos | Photos are present, named `<issue>-before/after`, and captioned with issue name and slot |
| 5.13 | Add Issue → name it → Create issue | A new Trello card is created and linked to the event card |
| 5.14 | Try photographing an unsaved new issue | Prompted to save it first |

**5.3/5.4 are the regression check** for the duplicate-screen navigation bug.
**5.9–5.11** are the offline behavior the trail actually requires.

## 6. Metrics

| # | Step | Expected |
|---|---|---|
| 6.1 | Expand a metrics category, increment a field | Saves after ~400ms |
| 6.2 | Fill every field | Counter reads "15 of 15 filled" and never exceeds the total **[auto]** |
| 6.3 | Reopen the event | Values persisted |

## 7. Ending, summary, drafts, publish

| # | Step | Expected |
|---|---|---|
| 7.1 | Tap Stop with photos still queued | Uploads flush before the summary appears |
| 7.2 | Event summary | Only non-zero metrics shown; hours of service reflects the real elapsed time |
| 7.3 | Tap "Edit event now" | Notepad text is **preserved** into the draft |
| 7.4 | Tap "Save as draft" | Appears under Drafts |
| 7.5 | Reopen the draft, save it again, check hours of service | **Unchanged** — not inflated by the time it sat as a draft |
| 7.6 | Confirm another user's drafts | Not visible to you |
| 7.7 | Publish a draft | Trello card moves to Completed Events, attached issue cards move to Completed Issues, and only then does it leave Drafts |
| 7.8 | Publish with the Trello board unreachable | Fails, and the event **stays** in Drafts so it can be retried |
| 7.9 | Home screen Past Events | Shows real published events with a "Completed" pill — not the old placeholder list, not "Not started" |

**7.5 is the regression check** for the `endDate` clobber.
**7.8 is the regression check** for the publish-ordering bug.

## 8. Albums

| # | Step | Expected |
|---|---|---|
| 8.1 | Albums tab as a non-admin | Locked |
| 8.2 | Albums tab as an admin | Lists albums from the **MVT** account |
| 8.3 | An album with zero photos | Renders with no photo badge and **no crash** |
| 8.4 | A second admin on another device | Sees the **same** albums |
| 8.5 | Pull to refresh | Reloads |

**8.3 is the regression check** for the bare-`0` render crash.
**8.4** is the point of the whole backend proxy.

## 9. Before/after graphic

| # | Step | Expected |
|---|---|---|
| 9.1 | Home → Make Before/After Graphic, pick two photos, save | Composite saved to the camera roll |

## 10. Take After Picture

| # | Step | Expected |
|---|---|---|
| 10.1 | Tap it with **no** active event | "No event in progress" explaining what to do |
| 10.2 | Tap it **with** an active event | Opens that event's document screen to pick an issue |

**Both are the regression check** for the card having had no handler at all.

## 11. Backend failure modes

| # | Step | Expected |
|---|---|---|
| 11.1 | Stop the backend, try to create an album | Clear error, not a silent failure |
| 11.2 | Unset `EXPO_PUBLIC_BACKEND_URL`, rebuild, open Albums | Explicit "EXPO_PUBLIC_BACKEND_URL is not set" |
| 11.3 | Call `/api/albums` with no Authorization header | `401` **[auto]** |
| 11.4 | Revoke the MVT Google grant, then upload | `401` "Not authenticated. Admin must sign in." |
| 11.5 | Upload a file over the size limit | `413` with a readable message **[auto]** |

## 12. Not covered here

- **EAS builds.** `eas init` and the expo.dev environment variables need your
  Expo account; until they exist, cloud builds ship undefined config.
- **iOS/Android native rebuild.** `app.json` now says
  `com.hack4impact.mountvernontrail` for both platforms, but the generated
  `ios/` and `android/` projects still carry `com.anonymous.*`. Run
  `npx expo prebuild --clean` before any store build, and check whether the
  Google OAuth client needs the new bundle id.
- **Firestore rules.** Now covered automatically — `cd firestore && npm test`
  runs 35 assertions against the real `firestore.rules` on the emulator, with
  no credentials. Nothing to check by hand.
