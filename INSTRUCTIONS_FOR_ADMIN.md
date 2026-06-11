# Publishing `@seatmaps.com/angular-lib` to npm — admin checklist

You have admin rights on both the `Kwiket/jets-seatmap-angular-lib` GitHub repo and the `@seatmaps.com` npm scope. Andrey has prepared the repo for npm Trusted Publishing (OIDC, no long-lived token), but the very first version of the package has to go out through a one-time bootstrap because npm Trusted Publisher cannot be configured for a package that does not yet exist on the registry ([npm/cli#8544](https://github.com/npm/cli/issues/8544)).

There are two flows below: **A** is a one-time setup for the very first publish; **B** is what you do for every subsequent release.

---

## A. First-ever release of `@seatmaps.com/angular-lib` (one-time)

### A1. Approve and merge the PR

A PR from `dev` → `main` contains:
- `provenance: true` in `projects/seatmap-lib/package.json` → `publishConfig`
- `.github/workflows/publish.yml` — the OIDC-based publishing workflow used for every subsequent release
- `.github/workflows/bootstrap-publish.yml` — the one-shot workflow used in step A3 below; will be deleted afterwards
- a library version in `projects/seatmap-lib/package.json` (e.g. `0.0.1`)

Approve and merge into `main` as usual. Nothing publishes at this point.

### A2. (one-time) Create the `npm-publish` GitHub Environment

Settings → **Environments** → New environment → `npm-publish`.

- **Required reviewers**: add yourself (and ideally one more maintainer).
- **Deployment branches and tags**: restrict to `main`.
- Save.

Both `bootstrap-publish.yml` and `publish.yml` route through this environment, so every publish — bootstrap or normal — pauses here and waits for your approval.

### A3. Run `Bootstrap publish (first npm version only)`

Actions → **Bootstrap publish (first npm version only)** → **Run workflow** → branch `main` → Run.

The job will:
1. Build the library.
2. Run a guard against API keys leaking into the artifact.
3. Pause on the `npm-publish` environment gate — click **Review deployments** → **Approve and deploy**.
4. `npm publish --provenance --access public` using the existing repo secret `NPM_TOKEN` for auth.

Verify:
- `npm view @seatmaps.com/angular-lib version` returns the version that was in `package.json`.
- `https://www.npmjs.com/package/@seatmaps.com/angular-lib` is now a real page; it should also show a green **Provenance** badge with a link back to the GitHub Actions run.

### A4. (one-time) Configure the Trusted Publisher on npm

Now that the package exists, the npm Trusted Publisher form is reachable. Sign in to npmjs.com → open `https://www.npmjs.com/package/@seatmaps.com/angular-lib/access` → **Trusted Publisher** section → Add.

Fill in **exactly**:

| Field | Value |
|---|---|
| Provider | GitHub Actions |
| Organization or user | `Kwiket` |
| Repository | `jets-seatmap-angular-lib` |
| Workflow filename | `publish.yml` |
| Environment | `npm-publish` |

Save. From now on, npm will accept short-lived OIDC tokens from `publish.yml` running in the `npm-publish` environment instead of `NPM_TOKEN`.

### A5. (one-time) Clean up

Open a small PR that:
- Deletes `.github/workflows/bootstrap-publish.yml` (it must never run again — the trusted-publisher path is now authoritative).
- Optionally bumps the library version in `projects/seatmap-lib/package.json` if you want to ship a second release straight away.

Merge that PR. After it lands on `main`, the bootstrap path is gone and only the OIDC `publish.yml` flow remains.

### A6. (one-time, after a successful flow B release) Revoke `NPM_TOKEN`

Wait until at least one release has gone out via flow B below (proving OIDC works end-to-end). Then:

1. GitHub → repo Settings → **Secrets and variables** → **Actions** → delete `NPM_TOKEN`.
2. npmjs.com → account Settings → **Access Tokens** → revoke the same token.

After that, no long-lived publishing credential exists anywhere.

---

## B. Every subsequent release

### B1. Verify the version bump is on `main`

A small PR should land in `main` bumping `projects/seatmap-lib/package.json` `version` (e.g. `0.0.1` → `0.1.0`). The `publish.yml` workflow fails loudly if the tag and the file disagree.

### B2. Create the GitHub Release

GitHub → **Releases** → Draft new release.

- **Tag**: `v<version>` matching the version in `projects/seatmap-lib/package.json` (e.g. `v0.1.0`).
- **Target**: `main`.
- Title and release notes: free form.
- **Publish release**.

This triggers `Publish to npm`.

### B3. Approve the workflow run

Actions → **Publish to npm** → the run pauses on the `npm-publish` environment gate. Click **Review deployments** → **Approve and deploy**.

The job will:
1. Verify `package.json` version matches the tag.
2. Build the library.
3. Run the secret-leak guard.
4. `npm publish --provenance --access public` — auth handled by OIDC (no token).

### B4. Verify

- `npm view @seatmaps.com/angular-lib version` returns the new version.
- The package page on npmjs.com shows the green **Provenance** badge linking back to the GitHub Actions run.

---

## Troubleshooting

- **`npm publish` says `403 Forbidden - PUT https://registry.npmjs.org/...`** during flow B: the Trusted Publisher on npmjs.com is missing or the `Workflow filename` / `Environment` fields do not exactly match `publish.yml` and `npm-publish`. Recheck step A4.
- **Bootstrap workflow run fails with `ENEEDAUTH`**: the repo secret `NPM_TOKEN` is missing or expired. Generate a new automation token on npmjs.com, add it as repo secret `NPM_TOKEN`, retry.
- **`publish.yml` aborts with version mismatch**: the GitHub Release tag (`v0.1.0`) and `projects/seatmap-lib/package.json` version (`0.1.0`) disagree. Fix the file, merge, re-cut the release with the correct tag.
