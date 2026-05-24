# W3KITS

## Upstream

- source repository: `https://github.com/liujuntao123/nano-kit`
- marketplace slug: `nano-kit`
- published package: `@w3kits/plugin-nano-kit`
- runtime: `browser-web`

## What W3Kits Changes

- packages the static browser build as a W3Kits plugin
- emits `dist/` with `scripts/prepare-dist.mjs`
- expects W3Kits AI access through `W3KITS_OPENAI_BASE_URL`
- avoids adding plugin-specific backend services in V1

## What Stays Upstream-Owned

- editor UX and product surface
- upstream storage and feature decisions that do not block plugin packaging

## Build

```bash
pnpm build
```
