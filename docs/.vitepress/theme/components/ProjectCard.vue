<script setup lang="ts">
interface ProjectCardProps {
  title: string
  description: string
  badge: string
  icon: string
  link: string
}

defineProps<ProjectCardProps>()
</script>

<template>
  <a :href="link" class="project-card">
    <div class="project-card__header">
      <span class="project-card__badge">{{ badge }}</span>
      <span class="project-card__icon" aria-hidden="true">{{ icon }}</span>
    </div>
    <h3 class="project-card__title">{{ title }}</h3>
    <p class="project-card__description">{{ description }}</p>
  </a>
</template>
