---
title: Backend Overview
description: Backend stream scope and Phase 1 plan for SSP Sports Tracker cloud infrastructure.
outline: deep
---

# Overview

> [!TIP]
> 📁 This page is served from the backend-repo submodule. Clone with --recurse-submodules to see full content.

## API Reference

- Role: Senior Backend Engineer — Cloud Infrastructure
- Stack: Node.js 20+ · TypeScript · PostgreSQL + TimescaleDB · Redis · AWS af-south-1 · Kafka · Docker/Kubernetes
- Duration: 3 Months, Full-Time

## Week 1-3 Infrastructure

## Week 4-6 Auth and Core APIs

## Week 7-9 Data Ingestion

## Week 10-12 AGPS and Export

## Phase 1 Summary

| Week Range | Milestone |
| --- | --- |
| 1–3 | Project setup, PostgreSQL schema, TimescaleDB hypertables, AWS infrastructure |
| 4–6 | JWT/OAuth2 auth, user & team APIs, device management APIs |
| 7–9 | Session APIs, GPS & IMU ingestion, metrics calculation service |
| 10–12 | AGPS service, FIT/TCX/GPX/CSV export, Redis caching, BullMQ jobs, production hardening |

### Success Criteria

- <200ms p95 response
- 1000 GPS points/sec/device
- 99.9% uptime
- POPIA compliant
