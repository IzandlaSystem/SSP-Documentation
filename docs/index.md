---
layout: home
title: SSP Sports Tracker Docs
description: Central engineering documentation hub for the SSP Sports Tracker platform.
features:
  - icon: 🛰️
    title: Firmware Stream
    details: Zephyr RTOS documentation for nRF52 and nRF91 wearable firmware.
  - icon: ☁️
    title: Backend Stream
    details: AWS af-south-1 cloud APIs, ingestion pipelines, and data services.
  - icon: 🖥️
    title: Web Frontend Stream
    details: React coach dashboard and performance analytics portal documentation.
  - icon: 📱
    title: Mobile App Stream
    details: React Native athlete app docs for BLE, offline sync, and exports.
---

<HeroHome />

## Engineering Streams

<div class="project-grid">
  <ProjectCard
    title="Firmware"
    description="Zephyr RTOS firmware docs for sensors, BLE 5.3, GPS, and sport modes."
    badge="Firmware"
    icon="🛰️"
    link="https://izandlasystem.github.io/SSP-Documentation/projects/firmware/"
  />
  <ProjectCard
    title="Backend"
    description="Cloud API and ingestion architecture for high-frequency GPS and IMU telemetry."
    badge="Backend"
    icon="☁️"
    link="/projects/backend/"
  />
  <ProjectCard
    title="Web Frontend"
    description="Coach dashboard docs for team workflows, analytics, heat maps, and risk scoring."
    badge="Web"
    icon="🖥️"
    link="/projects/web-frontend/"
  />
  <ProjectCard
    title="Mobile App"
    description="Athlete app docs for BLE pairing, session tracking, and offline-first sync."
    badge="Mobile"
    icon="📱"
    link="/projects/mobile-app/"
  />
</div>

## How This Works

| Layer | Responsibility | Source of Truth |
| --- | --- | --- |
| Central Hub (`SSP-Documentation`) | VitePress site, navigation, theming, and publishing | This repository |
| Project Repositories | Actual engineering docs and implementation notes | Submodules under `docs/projects/*` |
| CI/CD | Build and publish to GitHub Pages on `main` | GitHub Actions |