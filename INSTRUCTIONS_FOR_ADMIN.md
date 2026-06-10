# Publishing `@seatmaps.com/angular-lib` to npm — admin checklist

You have admin rights on both the `Kwiket/jets-seatmap-angular-lib` GitHub repo and the `@seatmaps.com` npm scope. Andrey has prepared the repo for npm Trusted Publishing (OIDC, no long-lived token). Below is everything you need to do.

## 0. Prerequisite

A PR from `dev` → `main` is open and contains:
- `provenance: true` in `projects/seatmap-lib/package.json` → `publishConfig`
- new workflow `.github/workflows/publish.yml`
- a version bump in `projects/seatmap-lib/package.json` (e.g. `0.0.1` → `0.1.0`)

## 1. Approve and merge the PR

Approve and merge the PR into `main` as usual. No publish happens at this point — the workflow is only triggered by a GitHub Release.

## 2. (one-time) Create the `npm-publish` GitHub Environment

Settings → **Environments** → New environment → `npm-publish`.

- **Required reviewers**: add yourself (and ideally one more maintainer).
- **Deployment branches and tags**: restrict to `main`.
- Save.

The workflow will pause here and wait for your approval on every release.

## 3. (one-time) Configure the Trusted Publisher on npm

Sign in to npmjs.com → open `https://www.npmjs.com/package/@seatmaps.com/angular-lib/access` → **Trusted Publisher** section → Add.

Fill in **exactly**:

| Field | Value |
|---|---|
| Provider | GitHub Actions |
| Organization or user | `Kwiket` |
| Repository | `jets-seatmap-angular-lib` |
| Workflow filename | `publish.yml` |
| Environment | `npm-publish` |

Save. From now on, npm will accept short-lived OIDC tokens from this exact workflow/environment instead of a static `NPM_TOKEN`.

## 4. Create the GitHub Release

GitHub → **Releases** → Draft new release.

- **Tag**: `v<version>` matching the version in `projects/seatmap-lib/package.json` (e.g. `v0.1.0`). The workflow will fail loudly if these don't match.
- **Target**: `main`.
- Title and release notes: free form.
- **Publish release**.

This triggers `Publish to npm`.

## 5. Approve the workflow run

Actions → **Publish to npm** → the run will be paused on the `npm-publish` environment gate. Click **Review deployments** → **Approve and deploy**.

The job will then:
1. Verify `package.json` version matches the tag.
2. Build the library.
3. Run a guard against API keys leaking into the artifact.
4. `npm publish --provenance --access public`.

## 6. Verify

- `npm view @seatmaps.com/angular-lib version` returns the new version.
- `https://www.npmjs.com/package/@seatmaps.com/angular-lib` shows a green **Provenance** badge with a link back to the GitHub Actions run.

## 7. (one-time, after first successful OIDC release) Revoke the old token

Once step 6 is green, the long-lived token is no longer needed:

1. GitHub → repo Settings → **Secrets and variables** → **Actions** → delete `NPM_TOKEN`.
2. npmjs.com → account Settings → **Access Tokens** → revoke the same token.

After that, all future publishes go through Trusted Publishing only.

## For every subsequent release

Only steps **4 → 5 → 6** are needed. Steps 2, 3, 7 are one-time setup.
