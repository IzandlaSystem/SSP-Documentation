<script setup lang="ts">
const stats = [
  '4 Engineering Streams',
  '12-Week Phase 1',
  'AWS af-south-1',
  'POPIA Compliant',
]
</script>

<template>
  <section class="hero-home">
    <div class="hero-home__fx" aria-hidden="true"></div>
    <div class="hero-home__inner">
      <p class="hero-home__kicker">Izandla Systems</p>
      <h1 class="hero-home__title">
        SSP Sports Tracker
        <span>Documentation Hub</span>
      </h1>
      <p class="hero-home__subtitle">
        The engineering source of truth for firmware, cloud, web, and mobile.
      </p>
      <div class="hero-home__actions">
        <a class="hero-home__cta hero-home__cta--primary" href="/SSP-Documentation/guide/getting-started">
          Get Started →
        </a>
        <a
          class="hero-home__cta hero-home__cta--ghost"
          href="https://github.com/IzandlaSystem/SSP-Documentation"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <div class="hero-home__chips">
        <span
          v-for="(stat, idx) in stats"
          :key="stat"
          class="hero-home__chip"
          :style="{ animationDelay: `${0.25 + idx * 0.14}s` }"
        >
          {{ stat }}
        </span>
      </div>
    </div>
  </section>
</template>
