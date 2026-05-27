import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import HeroHome from './components/HeroHome.vue'
import ProjectCard from './components/ProjectCard.vue'
import './custom.css'

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HeroHome', HeroHome)
    app.component('ProjectCard', ProjectCard)
  },
}

export default theme
