<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import catalog from '../../../data/catalog.json'
const query = ref(''), category = ref('全部分类')
const categories = ['全部分类', ...new Set(catalog.map(c => c.category))]
const filtered = computed(() => catalog.filter(c => (category.value === '全部分类' || c.category === category.value) && `${c.name} ${c.category} ${c.id}`.toLowerCase().includes(query.value.toLowerCase())))
const featured = ['013', '018', '010', '001', '020', '032']
const ordered = computed(() => [...filtered.value].sort((a, b) => {
  const ai = featured.indexOf(a.id), bi = featured.indexOf(b.id)
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.index - b.index
}))
const kind = c => /图片|教师|LOGO|组图/.test(c.name) ? 'image' : /检索|查询/.test(c.name) ? 'search' : /导航|栏目|链接/.test(c.name) ? 'nav' : /内容|正文|简介|详细/.test(c.name) ? 'article' : 'list'
</script>
<template>
  <div class="catalog-page">
    <section class="catalog-list">
      <div class="catalog-tools"><div class="catalog-search"><span aria-hidden="true">⌕</span><input v-model="query" placeholder="搜索组件" aria-label="搜索组件"></div><label class="category-select">分类 <select v-model="category" aria-label="筛选分类"><option v-for="c in categories" :key="c">{{ c }}</option></select></label></div>
      <div class="category-chips"><button v-for="c in ['全部分类', '文章列表', '网站基础信息', '网站导航', '图片列表', '文章内容']" :key="c" @click="category = c" :class="{ active: category === c }">{{ c === '全部分类' ? '全部' : c }}</button></div>
      <div class="component-grid">
        <a v-for="c in ordered" :key="c.id" :href="withBase('/components/' + c.id)" class="component-card">
          <div class="card-preview" :class="'preview-' + kind(c)"><span class="card-number">{{ c.id }}</span>
            <div v-if="kind(c) === 'image'" class="mini-images"><span></span><span></span><span></span><i></i><i></i><i></i></div>
            <div v-else-if="kind(c) === 'search'" class="mini-search"><span>搜索</span><b>⌕</b></div>
            <div v-else-if="kind(c) === 'nav'" class="mini-nav"><b>首页</b><span>校园动态</span><span>通知公告</span><span>关于我们</span><i></i></div>
            <div v-else-if="kind(c) === 'article'" class="mini-article"><b></b><em></em><i></i><i></i><i></i><i></i></div>
            <div v-else class="mini-list"><div v-for="n in 3" :key="n"><b></b><span></span><i></i></div></div>
          </div>
          <div class="card-info"><div><span class="card-category">{{ c.category }}</span><h3>{{ c.name }}</h3></div><span class="card-arrow">↗</span></div>
          <div class="card-bottom"><span>{{ c.parameterCount }} 个参数</span><span>FTL <i>·</i> CSS</span></div>
        </a>
      </div>
      <div v-if="!filtered.length" class="empty-state"><strong>没有找到相关组件</strong><button class="secondary-button" @click="query = ''; category = '全部分类'">重置筛选</button></div>
    </section>
  </div>
</template>
