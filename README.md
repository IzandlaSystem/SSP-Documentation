# SSP Sports Tracker Documentation Hub

![Deploy Status](https://github.com/IzandlaSystem/SSP-Documentation/actions/workflows/deploy.yml/badge.svg)

Centralized VitePress documentation hub for SSP Sports Tracker engineering. This repository publishes a single source of truth site while project-specific docs remain authored in independent firmware, backend, web frontend, and mobile app repositories.

The firmware stream now sources from https://github.com/IzandlaSystem/SSP-S1-Firmware and should publish its docs from that repository's `docs/` folder.
Because the firmware repository is private, Vercel must have SSH or GitHub App access to clone the firmware submodule during build.

## Architecture

```text
firmware-repo      ─┐
backend-repo       ─┼─> git submodules in docs/projects/* ─> VitePress build ─> GitHub Pages
web-frontend-repo  ─┼
mobile-app-repo    ─┘
```

## Quick Start

```bash
git clone --recurse-submodules https://github.com/IzandlaSystem/SSP-Documentation.git
cd SSP-Documentation
npm install
npm run docs:dev
```

## Submodule Updates

```bash
npm run submodules:update
git add .gitmodules docs/projects
git commit -m "chore: update submodule refs"
git push
```

## Triggering Central Sync from Sub-Repos

Each upstream project CI pipeline should trigger a central sync after docs changes:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${{ secrets.CENTRAL_DOCS_PAT }}" \
  https://api.github.com/repos/IzandlaSystem/SSP-Documentation/dispatches \
  -d '{"event_type":"submodule-updated"}'
```

## Live Site

https://izandlasystem.github.io/SSP-Documentation/

Firmware page:

https://izandlasystem.github.io/SSP-Documentation/projects/firmware/

## Vercel Deployment

Yes, this docs hub can be deployed on Vercel.

Use these settings in a Vercel project:

- Build Command: `npm run docs:build`
- Output Directory: `docs/.vitepress/dist`
- Node.js Version: `20`

The config detects `VERCEL` automatically and uses `/` as the base path, so routes work at the root of the Vercel deployment.

For Vercel to fetch the private firmware submodule successfully, ensure the project has access to the private repo and the firmware submodule URL remains the SSH form in [.gitmodules](.gitmodules).

## GitHub Pages Private Submodule Access

GitHub Pages deployment requires the GitHub Actions workflow to authenticate to the private firmware repo.

Add a repository secret named `SUBMODULES_PAT` containing a fine-grained personal access token with read access to [SSP-S1-Firmware](https://github.com/IzandlaSystem/SSP-S1-Firmware).

The workflow uses that secret to clone the firmware submodule during the Pages build.

The token only needs repository read access to the private firmware repo.