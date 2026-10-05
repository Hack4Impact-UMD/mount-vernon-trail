# mount-vernon-trail

## Intro

Hello and welcome to the Friends of the Mount Vernon Trail project!
We'll be working, communicating, and logging bugs here, as well as in our other communication channels.

Volunteers use the app to document trail issues during a work event: they photograph a problem before and after fixing it, record metrics, and publish a summary to Trello. The photos go into a **shared Google Photos album owned by the MVT account**, which is what the backend exists to make possible.

## Repo layout

- [`frontend/`](frontend/) — the Expo (React Native) app. `cd frontend && npm install && npm start`.
- [`backend/`](backend/) — Node + TypeScript service that proxies Google Photos uploads into the MVT-owned album. Volunteers authenticate to it with their Firebase ID token; it holds the single Google refresh token. Deployed on Render. See [`backend/README.md`](backend/README.md) for the API and setup.
- [`firestore.rules`](firestore.rules) / [`firestore.indexes.json`](firestore.indexes.json) — Firestore security rules and composite indexes. Deployed by a lead, indexes before rules — see [Admin setup](#admin-setup-once-per-firebase-project-leads-only).
- [`firestore/`](firestore/) — emulator-backed tests for those rules.

## Setup

For every engineer. Ask a lead for the `.env` values; the app and backend both
run against the shared `friends-of-mvt` Firebase project.

1. `cd frontend && npm install`, then `cp .env.example .env` and fill it in.
2. `cd backend && npm install`, then `cp .env.example .env` and fill it in.

That is all a development machine needs. Don't run the admin steps below against
the shared project unless you are the one doing them for the team.

### Admin setup (once per Firebase project, leads only)

These change shared state for everyone, so they are done once per project, not
per engineer:

- **If the project has data from before the ownership refactor** (true of
  `friends-of-mvt` until the refactor is deployed), follow the
  [ownership migration runbook](docs/runbooks/2026-08-ownership-migration.md)
  instead of the deploy step below. It deploys indexes and rules itself, with a
  backfill in between; deploying rules first locks users out of their events.
- **Deploy Firestore indexes, then rules**, in that order, from the repo root.
  Wait for every index to report `READY` before deploying rules; `--pretty` is
  what makes the output show each index's state.

    ```bash
    npx firebase deploy --only firestore:indexes
    npx firebase firestore:indexes --pretty
    npx firebase deploy --only firestore:rules
    ```

- **Grant the `admin` claim** to the people who need it:
  `cd backend && npm run set-admin -- someone@example.com`. They sign out and
  back in for it to take effect.
- **Link the MVT Google account** to the backend — see the
  [backend README](backend/README.md).

## Checks

Both halves run the same three gates; CI enforces them on every PR.

```bash
cd frontend  && npm run typecheck && npm run lint && npm test
cd backend   && npm run typecheck && npm run lint && npm test
cd firestore && npm test   # boots the Firestore emulator, asserts firestore.rules
```

The rules suite needs Java (for the emulator) but no credentials and no live
Firebase project — it runs `firestore.rules` against a throwaway emulator
instance. `firebase-tools` is a local devDependency of `firestore/`, so use
`npx firebase` rather than a global install.

[`MANUAL_TEST_PLAN.md`](MANUAL_TEST_PLAN.md) covers the flows that need real Google/Trello credentials.

## Procedures

### Cloning

Please clone with SSH. [See here](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent) to set up a key for your device if it doesn't have one already. [Check this out](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) for step-by-step instructions on cloning a repo.

### Making branches, commits, + PRs

[Explore the PR documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-branches)

Every task will be completed on its own branch. If there are multiple engineers on your task, you can all use the same branch. You can create the remote branch first or create locally and push it.

**Branch naming convention**: Please start new feature task branches with `feature/` and bug fix task branches with `bugfix/`.

Aim for short, descriptive commit messages. A good way to think about it is to imagine your commit message finishes the sentence "This commit will...". Also, double-check that you're on your branch and not committing secrets or .env information. Then, push your changes to your branch!

**Pull from main**, merge it into your branch, and test your code again before PRing. This will hopefully mean that you'll be all set to merge once we approve it.

When you're done with the task and have tested your code, make a PR for us to review. Give it a descriptive title. A template should populate with guidelines on how to fill out the description. The more information you give us, the faster we'll be able to get your PR approved!

**Requesting review**: Our github usernames are `bsthapar` and `asea-aranion`.

#### An example

```
git checkout -b feature/login

# add/edit files

# the following can also be done in vscode source control
git add -A
git commit -m "create login page frontend"
git push -u origin feature/login
# for subsequent pushes, just 'git push' will work

# repeat until task is complete

git checkout main
git pull origin main
git checkout feature/login
git merge main
# resolve conflicts
# open github and make PR
```

## Meet the engineers!

### Fall 2026

<table align="center">
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="https://www.linkedin.com/in/soumya-jaiswal7">
        <img src="/frontend/profile-pictures/soumya_jaiswal.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Soumya Jaiswal</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
	<td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
</table>

### Spring 2026

<table align="center">
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="https://www.linkedin.com/in/jameszhoudev/">
        <img src="/frontend/profile-pictures/james_zhou.jpeg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>James Zhou</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="https://jaipatel.netlify.app/">
        <img src="/frontend/profile-pictures/jai_patel.png" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Jai Patel</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/aaryan_patel.png" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Aaryan Patel</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="http://linkedin.com/in/ryanzhao27/">
        <img src="/frontend/profile-pictures/ryan_zhao.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Ryan Zhao</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="#">
        <img src="/frontend/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="https://www.linkedin.com/in/chloexthompson">
        <img src="/frontend/profile-pictures/chloe_thompson.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Chloe Thompson</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="https://www.linkedin.com/in/srinidhi-gubba/">
        <img src="/frontend/profile-pictures/srinidhi_gubba.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Srinidhi Gubba</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="https://www.linkedin.com/in/indira-shafii/">
        <img src="/frontend/profile-pictures/indira.png" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Indira Shafii</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
</table>
