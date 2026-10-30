<script setup>
import { ref, computed } from 'vue'
import { withBase } from 'vitepress'
import Playground from './Playground.vue'
const props = defineProps({ component: Object })
const playground = ref(), filter = ref(''), toast = ref('')
const item = computed(() => props.component)
const parameters = computed(() => {
  const result = []; let current
  for (const p of item.value.parameters) {
    if (p.kind === 'parameter') { current = { ...p, examples: [] }; result.push(current) }
    else if (p.kind === 'example' && current && p.syntax) current.examples.push(p.syntax)
  }
  return result
})
const filtered = computed(() => parameters.value.filter(p => `${p.name} ${p.parameter} ${p.type} ${p.description} ${p.syntax} ${(p.path || []).join('.')}`.toLowerCase().includes(filter.value.toLowerCase())))
async function copy(text) { try { await navigator.clipboard.writeText(text); toast.value = '语法已复制' } catch { toast.value = '请选中语法手动复制' } setTimeout(() => { toast.value = '' }, 2400) }
</script>
<template>
  <article class="component-page">
    <div class="breadcrumb"><a :href="withBase('/')">组件库</a><span>/</span><span>{{ item.category }}</span><span>/</span><strong>{{ item.name }}</strong></div>
    <header class="component-heading"><div><h1>{{ item.name }}<span class="component-badge">{{ item.category }}</span></h1></div><a :href="withBase('/syntax/')" class="text-link">模板语法参考 ↗</a></header>
    <Playground :key="item.id" ref="playground" :template="item.template" :css="item.css" :data="item.fixture" :parameters="item.parameters" :storage-key="item.id" :example-template="item.exampleTemplate" :previous-fixture-hashes="item.previousFixtureHashes" />
    <section class="api-section">
      <div class="api-intro"><div><h2>参数 API <span class="result-count">{{ item.parameterCount }}</span></h2></div><div class="api-search"><span>⌕</span><input v-model="filter" placeholder="搜索参数" aria-label="搜索参数"></div></div>
        <div class="api-table-wrap"><table class="api-table"><thead><tr><th>参数 / 名称</th><th>类型</th><th>说明与语法</th><th><span class="sr-only">操作</span></th></tr></thead><tbody><template v-for="(p, i) in filtered" :key="i"><tr v-if="p.type === 'Group'" class="api-group"><td colspan="4"><span>▾</span>{{ p.name }}<code>{{ p.parameter }}</code><small v-if="p.path.length">{{ p.path.join(' / ') }}</small></td></tr><tr v-else><td><code class="param-name">{{ p.parameter }}</code><span class="param-label">{{ p.name }}</span><small v-if="p.path.length" class="param-path">{{ p.path.join(' / ') }}</small></td><td><span class="type-tag" :class="'type-' + p.type?.toLowerCase()">{{ p.type }}</span></td><td><p v-if="p.description" class="param-description">{{ p.description }}</p><pre v-if="p.syntax" class="param-syntax"><code>{{ p.syntax }}</code></pre><details v-if="p.examples.length" class="parameter-examples"><summary>{{ p.examples.length }} 个使用示例</summary><div v-for="(example, j) in p.examples" :key="j"><pre><code>{{ example }}</code></pre><button @click="playground.insert(example)">插入示例 ↑</button></div></details></td><td><div v-if="p.syntax" class="param-actions"><button @click="playground.insert(p.syntax)" title="插入到模板">插入 ↑</button><button @click="copy(p.syntax)" title="复制参数语法">复制</button></div></td></tr></template></tbody></table><div v-if="!filtered.length" class="empty-state">没有找到匹配的参数</div></div>
    </section><div v-if="toast" class="toast" role="status">{{ toast }}</div>
    <footer class="component-footer"><span>组件 {{ item.id }} · {{ item.name }}</span><a :href="withBase('/')">返回组件库 →</a></footer>
  </article>
</template>
