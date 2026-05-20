# @kwiket/jets-seatmap-angular-lib

Angular seatmap component library.

This repo hosts:

- **`projects/seatmap-lib/`** — the publishable Angular library (`@kwiket/jets-seatmap-angular-lib`).
- **`projects/seatmap-demo/`** — a minimal demo app used during library development. Not published.

## Install

```bash
npm install
```

## Build the library

```bash
npm run build:lib
```

Artifacts go to `dist/seatmap-lib/`.

## Run the dev demo

```bash
cp projects/seatmap-demo/src/environments/environment.ts \
   projects/seatmap-demo/src/environments/environment.local.ts
# fill in real apiUrl / apiAppId / apiKey
npm start
```

The dev-server's `fileReplacements` swap `environment.ts` for `environment.local.ts`. `environment.local.ts` is gitignored.

## Tests

```bash
npm test
```

## Publishing

```bash
npm run build:lib
cd dist/seatmap-lib
npm publish --access public
```

## Consuming from another repo before npm publish

The library is distributed via a separate `release` branch in this repo that contains the **built ng-packagr artifact at the repo root** (the contents of `dist/seatmap-lib/` after `npm run build:lib`). A consuming app then references it as a git dependency:

```jsonc
// consumer's package.json
{
  "dependencies": {
    "@kwiket/jets-seatmap-angular-lib": "github:Kwiket/jets-seatmap-angular-lib#release"
  }
}
```

### Publishing a new release-branch build

```bash
npm run build:lib
git worktree add -B release ../release-tmp --no-checkout
cd ../release-tmp
cp -R ../jets-seatmap-angular-lib/dist/seatmap-lib/. .
git add -A
git commit -m "release: @kwiket/jets-seatmap-angular-lib@$(node -p \"require('./package.json').version\")"
git push origin release --force
cd - && git worktree remove ../release-tmp
```

(A GitHub Action could automate this on every push to `main`.)
