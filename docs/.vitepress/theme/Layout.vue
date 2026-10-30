<script setup>
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import AppLayout from './components/AppLayout.vue'
const { frontmatter } = useData()
</script>
<template>
  <AppLayout v-if="frontmatter.layout === 'page'"><Content /></AppLayout>
  <DefaultTheme.Layout v-else />
</template>
