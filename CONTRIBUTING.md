# Contributing

Thanks for taking the time to contribute to `@seatmaps.com/angular-lib`.

## Getting started

```bash
git clone git@github.com:Kwiket/jets-seatmap-angular-lib.git
cd jets-seatmap-angular-lib
npm ci
```

The library lives in `projects/seatmap-lib`, the demo application in
`projects/seatmap-demo`. See `README.md` for an overview of the architecture.

## Development workflow

1. **Fork** the repository and create a topic branch from `main`:

   ```bash
   git checkout -b feat/short-description main
   ```

2. **Implement** the change. Match the existing code style; the repo uses
   Prettier (`npm run format`) and Husky runs it on every commit.

3. **Run the test suite** before opening a PR:

   ```bash
   npm test            # unit tests (seatmap-lib)
   npm run build:lib   # library build must succeed
   npm run e2e         # Playwright e2e (requires SEATMAP_API_* env vars)
   ```

4. **Open a Pull Request** against `main`. PRs require a passing CI run
   (`Unit tests`, `Build library and demo`, `Playwright e2e`, `Analyze
   (javascript-typescript)`) and at least one approving review.

## Commit messages

We follow Conventional Commits with a scope:

```
feat(seatmap-lib): add multi-cabin layout support
fix(seatmap-lib): keep boundary bulks/exits in first and last cabin sub-decks
test(e2e): add parity-proof screenshot for seatMapInited payload
```

Common types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`,
`build`, `ci`. Keep the subject under ~72 characters and write in the
imperative mood.

## Reporting bugs and suggesting features

- **Security issues** — please follow `SECURITY.md` (private disclosure).
- **Bugs** — open an issue with a minimal reproduction, the lib version and
  browser/Node version.
- **Feature requests** — describe the use case before proposing API shape; it
  helps reviewers evaluate the trade-offs.

## License

By contributing, you agree that your contributions will be licensed under the
Apache License 2.0 (see `LICENSE`).
