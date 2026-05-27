---
title: Getting Started
description: Bootstrap, run, and maintain the SSP Sports Tracker documentation hub.
outline: deep
---

# Getting Started

## 1. Repository Setup

Clone the central hub repository with submodules so all project documentation mounts are pulled in one command:

```bash
git clone --recurse-submodules https://github.com/IzandlaSystem/SSP-Documentation.git
cd SSP-Documentation
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

## 2. Local Development

Install dependencies and start the VitePress dev server:

```bash
npm install
npm run docs:dev
```

Build and preview production output locally:

```bash
npm run docs:build
npm run docs:preview
```

## 3. Submodule Overview

Each engineering stream is mounted in `docs/projects`:

| Submodule | Mount Path | Typical Content |
| --- | --- | --- |
| `firmware-repo` | `docs/projects/firmware` | Device firmware architecture, drivers, BLE, GPS, sport modes |
| `backend-repo` | `docs/projects/backend` | Cloud APIs, data ingestion, auth, export pipelines |
| `web-frontend-repo` | `docs/projects/web-frontend` | React dashboard, analytics UI, state and component docs |
| `mobile-app-repo` | `docs/projects/mobile-app` | React Native app architecture, BLE, offline sync, exports |

## 4. Adding Documentation

Engineers should add or update Markdown files in their own project repository where that project keeps docs (commonly a `docs/` folder).

Guidelines:

1. Use `index.md` for section landing pages.
2. Keep frontmatter titles and descriptions consistent.
3. Link docs with relative Markdown links for portability.
4. Ensure sections align to this hub's sidebar labels, or update `docs/.vitepress/config.mts` when structure changes.

Once submodule references are updated in the central repo, those files appear in this site build.

## 5. Updating Submodules

Pull the latest submodule commits and then commit the pointer updates in the central repo:

```bash
npm run submodules:update
git add .gitmodules docs/projects
git commit -m "chore: update submodule refs"
git push
```

## 6. Build & Deploy

Deployment is automated through GitHub Actions. Any push to `main` builds `docs/.vitepress/dist` and publishes to GitHub Pages.

Manual deployment can also be triggered from the Actions tab using `workflow_dispatch`.