import { defineConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress/theme'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type SidebarGroup = {
  text: string
  items: DefaultTheme.SidebarItem[]
}

const firmwareDocsDir = join(__dirname, '..', 'projects', 'firmware', 'docs')

function getBase() {
  if (process.env.VITEPRESS_BASE) return process.env.VITEPRESS_BASE
  if (process.env.VERCEL) return '/'
  return process.env.NODE_ENV === 'production' ? '/SSP-Documentation/' : '/'
}

function readFrontmatterTitle(filePath: string) {
  const content = readFileSync(filePath, 'utf8')
  const match = content.match(/^---\n[\s\S]*?^title:\s*['"]?([^'"\n]+)['"]?[\s\S]*?^---/m)
  return match?.[1]?.trim() ?? ''
}

function titleizeFileName(fileName: string) {
  return fileName
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function firmwareRoute(fileName: string) {
  if (fileName.toLowerCase() === 'readme.md') return '/projects/firmware/'
  return `/projects/firmware/${fileName.replace(/\.md$/i, '')}`
}

function buildFirmwareSidebar(): SidebarGroup[] {
  if (!existsSync(firmwareDocsDir)) return []

  const files = readdirSync(firmwareDocsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.md'))
    .sort((left, right) => left.localeCompare(right))

  const ordered = [
    'README.md',
    'getting-started.md',
    'architecture.md',
    'hardware.md',
    'zephyr-rtos.md',
    'bootloader-dfu.md',
    'hal-drivers.md',
    'build-flash-debug.md',
    'ble-services.md',
    'gnss-ubx.md',
    'power-management.md',
    'sensor-fusion.md',
    'sport-modes.md',
    'phase1.md',
  ]

  const fileSet = new Set(files)
  const orderedFiles = ordered.filter((fileName) => fileSet.has(fileName))

  return [
    {
      text: 'Firmware (SSP-S1-Firmware)',
      items: orderedFiles.map((fileName) => ({
        text:
          fileName === 'README.md'
            ? 'Overview'
            : readFrontmatterTitle(join(firmwareDocsDir, fileName)) || titleizeFileName(fileName),
        link: firmwareRoute(fileName),
      })),
    },
  ]
}

function rewriteSubmoduleDocs(sourcePath: string) {
  const firmwareRoot = sourcePath.match(/^projects\/firmware\/docs\/(.+)$/)
  if (firmwareRoot) {
    const innerPath = firmwareRoot[1]
    if (/^README\.md$/i.test(innerPath)) return 'projects/firmware/index.md'
    return `projects/firmware/${innerPath}`
  }

  return sourcePath
}

const sidebar: DefaultTheme.Sidebar = {
  '/guide/': [
    {
      text: 'Guide',
      items: [{ text: 'Getting Started', link: '/guide/getting-started' }],
    },
  ],
  '/projects/firmware/': [
    {
      text: 'Firmware (SSP-S1-Firmware)',
      items: [
        { text: 'Overview', link: '/projects/firmware/' },
        { text: 'Architecture', link: '/projects/firmware/#architecture' },
        { text: 'Week 1–4: Core Firmware', link: '/projects/firmware/#week-1-4-core-firmware' },
        {
          text: 'Week 5–8: Connectivity & Power',
          link: '/projects/firmware/#week-5-8-connectivity-and-power',
        },
        { text: 'Week 9–12: GPS & Sport Modes', link: '/projects/firmware/#week-9-12-gps-and-sport-modes' },
      ],
    },
  ],
  '/projects/backend/': [
    {
      text: 'Backend (backend-repo)',
      items: [
        { text: 'Overview', link: '/projects/backend/' },
        { text: 'API Reference', link: '/projects/backend/#api-reference' },
        {
          text: 'Week 1–3: Infrastructure',
          link: '/projects/backend/#week-1-3-infrastructure',
        },
        { text: 'Week 4–6: Auth & Core APIs', link: '/projects/backend/#week-4-6-auth-and-core-apis' },
        { text: 'Week 7–9: Data Ingestion', link: '/projects/backend/#week-7-9-data-ingestion' },
        { text: 'Week 10–12: AGPS & Export', link: '/projects/backend/#week-10-12-agps-and-export' },
      ],
    },
  ],
  '/projects/web-frontend/': [
    {
      text: 'Web Frontend (web-frontend-repo)',
      items: [
        { text: 'Overview', link: '/projects/web-frontend/' },
        { text: 'Component Library', link: '/projects/web-frontend/#component-library' },
        { text: 'Week 1–3: Setup & Auth', link: '/projects/web-frontend/#week-1-3-setup-and-auth' },
        { text: 'Week 4–6: Team & Sessions', link: '/projects/web-frontend/#week-4-6-team-and-sessions' },
        { text: 'Week 7–9: Analytics', link: '/projects/web-frontend/#week-7-9-analytics' },
        {
          text: 'Week 10–12: Heat Maps & Risk',
          link: '/projects/web-frontend/#week-10-12-heat-maps-and-risk',
        },
      ],
    },
  ],
  '/projects/mobile-app/': [
    {
      text: 'Mobile App (mobile-app-repo)',
      items: [
        { text: 'Overview', link: '/projects/mobile-app/' },
        { text: 'Architecture', link: '/projects/mobile-app/#architecture' },
        { text: 'Week 1–3: Setup & BLE', link: '/projects/mobile-app/#week-1-3-setup-and-ble' },
        { text: 'Week 4–6: Auth & Devices', link: '/projects/mobile-app/#week-4-6-auth-and-devices' },
        {
          text: 'Week 7–9: Real-Time Tracking',
          link: '/projects/mobile-app/#week-7-9-real-time-tracking',
        },
        {
          text: 'Week 10–12: Analytics & Export',
          link: '/projects/mobile-app/#week-10-12-analytics-and-export',
        },
      ],
    },
  ],
}

export default defineConfig({
  lang: 'en-US',
  title: 'SSP Sports Tracker Docs',
  description: 'Central engineering documentation hub for the SSP Sports Tracker platform.',
  base: getBase(),
  appearance: 'dark',
  lastUpdated: true,
  cleanUrls: true,
  rewrites: rewriteSubmoduleDocs,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'SSP Sports Tracker Docs' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'The engineering source of truth for firmware, cloud, web, and mobile.',
      },
    ],
    ['meta', { property: 'og:image', content: '/logo.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'Firmware', link: '/projects/firmware/' },
      { text: 'Backend', link: '/projects/backend/' },
      { text: 'Web Frontend', link: '/projects/web-frontend/' },
      { text: 'Mobile App', link: '/projects/mobile-app/' },
    ],
    sidebar: {
      ...sidebar,
      '/projects/firmware/': buildFirmwareSidebar(),
    },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/IzandlaSystem/SSP-Documentation/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/IzandlaSystem/SSP-Documentation',
      },
    ],
    footer: {
      message: 'Built by Izandla Systems · POPIA Compliant',
      copyright: 'Copyright © 2026 Izandla Systems',
    },
  },
})