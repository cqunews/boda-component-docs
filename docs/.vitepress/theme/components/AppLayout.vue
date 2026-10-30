<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, withBase } from 'vitepress'
import catalog from '../../../data/catalog.json'
const route = useRoute(), query = ref(''), open = ref(false), searchInput = ref()
function shortcut(event) { if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !event.target.isContentEditable) { event.preventDefault(); if (window.innerWidth <= 800) open.value = true; setTimeout(() => searchInput.value?.focus(), 0) } if (event.key === 'Escape') open.value = false }
onMounted(() => document.addEventListener('keydown', shortcut))
onBeforeUnmount(() => document.removeEventListener('keydown', shortcut))
const groups = computed(() => {
  const result = new Map()
  for (const c of catalog) {
    if (query.value && !`${c.name} ${c.id} ${c.category}`.toLowerCase().includes(query.value.toLowerCase())) continue
    if (!result.has(c.category)) result.set(c.category, [])
    result.get(c.category).push(c)
  }
  return [...result].map(([name, items]) => ({ name, items }))
})
const active = id => route.path.includes('/components/' + id)
watch(() => route.path, () => { open.value = false })
</script>
<template>
  <div class="studio">
    <a class="skip-link" href="#main-content">跳至内容</a>
    <header class="app-header">
      <a :href="withBase('/')" class="brand">博达组件文档</a>
      <nav aria-label="主导航"><a :href="withBase('/')" class="nav-active">组件库</a><a :href="withBase('/syntax/')">模板语法</a></nav>
      <button class="mobile-toggle" @click="open = !open" :aria-expanded="open" aria-label="展开组件目录">☰</button>
    </header>
    <div v-if="open" class="sidebar-overlay" @click="open = false"></div>
    <aside class="app-sidebar" :class="{ 'is-open': open }" aria-label="组件分类">
      <div class="sidebar-search"><span aria-hidden="true">⌕</span><input ref="searchInput" v-model="query" placeholder="搜索组件名称或编号…" aria-label="搜索侧栏组件"><kbd>/</kbd></div>
      <a :href="withBase('/')" class="sidebar-home" :class="{ selected: !route.path.includes('/components/') }"><span>▦</span>全部组件<span class="count">{{ catalog.length }}</span></a>
      <div class="sidebar-label">组件分类 <span>{{ groups.length }}</span></div>
      <div class="sidebar-groups">
        <details v-for="group in groups" :key="group.name" :open="!!query || group.items.some(c => active(c.id))">
          <summary><span class="chevron">›</span>{{ group.name }}<span class="count">{{ group.items.length }}</span></summary>
          <a v-for="c in group.items" :key="c.id" :href="withBase('/components/' + c.id)" :class="{ selected: active(c.id) }"><span class="component-index">{{ c.id }}</span>{{ c.name }}</a>
        </details>
        <p v-if="!groups.length" class="muted sidebar-empty">没有匹配的组件</p>
      </div>
    </aside>
    <main id="main-content" class="app-main"><slot /></main>
  </div>
</template>
