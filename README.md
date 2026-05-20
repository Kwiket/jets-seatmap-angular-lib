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

## Consuming from another repo before publish

```jsonc
// consumer's package.json
{
  "dependencies": {
    "@kwiket/jets-seatmap-angular-lib": "github:Kwiket/jets-seatmap-angular-lib#main"
  }
}
```

The `prepare` script in this repo's root `package.json` runs `ng build seatmap-lib` automatically when npm installs the git dependency, so the consumer gets the built artifact in `node_modules/@kwiket/jets-seatmap-angular-lib/dist/seatmap-lib/`.
