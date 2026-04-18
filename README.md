# CapitalView Web

Frontend application for CapitalView (Vue 3 + TypeScript + Tailwind v4).

## Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Tailwind CSS v4

## Local development

```bash
npm ci
npm run dev
```

## Quality/build

```bash
npm run type-check
npm run build
```

## Docker

```bash
docker build -f Dockerfile.prod -t capitalview-web:local .
```

## CI/CD

- CI workflow: `.github/workflows/ci.yml`
- CD workflow (build/push image): `.github/workflows/cd.yml`

The deployment orchestration (compose, reverse proxy, VPS rollout) should live in a dedicated infra repository.

## Required secret for image build

- `VITE_API_URL`
