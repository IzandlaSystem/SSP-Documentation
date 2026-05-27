<script setup lang="ts">
import { computed } from 'vue'

interface ProjectCardProps {
  title: string
  description: string
  badge: string
  icon: string
  link: string
}

const props = defineProps<ProjectCardProps>()

const href = computed(() => {
  const pagesRoot = 'https://izandlasystem.github.io/SSP-Documentation'
  // If link targets the firmware project root or its children, point to GitHub Pages
  if (props.link && props.link.startsWith('/projects/firmware')) {
    // Ensure leading slash present on props.link
    return pagesRoot + (props.link.startsWith('/') ? props.link : `/${props.link}`)
  }
  return props.link
})
</script>

<template>
  <a :href="href" class="project-card">
    <div class="project-card__header">
      <span class="project-card__badge">{{ props.badge }}</span>
      <span class="project-card__icon" aria-hidden="true">{{ props.icon }}</span>
    </div>
    <h3 class="project-card__title">{{ props.title }}</h3>
    <p class="project-card__description">{{ props.description }}</p>
  </a>
</template>
