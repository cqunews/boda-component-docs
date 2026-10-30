<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { migrateDraft } from '../../../../src/drafts.mjs'
import { get, set, del } from 'idb-keyval'
import CodeEditor from './CodeEditor.vue'
import RenderWorker from '../../../../src/engine/render.worker.mjs?worker'
import { buildPreview } from '../../../../src/preview.mjs'
const props = defineProps({ template: String, css: { type: String, default: '' }, data: { type: Object, default: () => ({}) }, parameters: { type: Array, default: () => [] }, storageKey: String, exampleTemplate: String, previousFixtureHashes: { type: Array, default: () => [] }, compact: Boolean })
const template = ref(props.template), css = ref(props.css), json = ref(JSON.stringify(props.data, null, 2))
const adapters = ref(true), adapterNotes = ref([]), fit = ref(true), previewOnly = ref(false), canvas = ref(), canvasSize = ref({ width: 440, height: 380 })
const tab = ref('ftl'), width = ref('1024'), customWidth = ref(768), background = ref('#ffffff'), strict = ref(false), error = ref(null), warnings = ref([]), srcdoc = ref(''), renderedHtml = ref(''), stats = ref(null), pending = ref(false), saveState = ref('本地草稿'), notice = ref(''), editor = ref(), scenario = ref('normal'), importInput = ref(), fullscreen = ref(false), outputOpen = ref(false)
const current = computed({ get: () => tab.value === 'ftl' ? template.value : tab.value === 'css' ? css.value : json.value, set: value => { if (tab.value === 'ftl') template.value = value; else if (tab.value === 'css') css.value = value; else json.value = value } })
const logicalWidth = computed(() => width.value === 'auto' ? canvasSize.value.width : width.value === 'custom' ? Math.max(240, Math.min(1920, Number(customWidth.value) || 768)) : Number(width.value))
const previewScale = computed(() => fit.value ? Math.min(1, canvasSize.value.width / logicalWidth.value) : 1)
const previewWidth = computed(() => Math.round(logicalWidth.value * previewScale.value) + 'px')
const iframeStyle = computed(() => ({ width: logicalWidth.value + 'px', height: Math.ceil(canvasSize.value.height / previewScale.value) + 'px', transform: `scale(${previewScale.value})`, transformOrigin: 'top left' }))
const baseline = { template: props.template, css: props.css, json: JSON.stringify(props.data, null, 2) }
const hasEdits = () => template.value !== baseline.template || css.value !== baseline.css || json.value !== baseline.json
const draftKey = props.storageKey ? 'boda:draft:v1:' + props.storageKey : null
const previewSettingsKey = props.storageKey ? 'boda:preview:v1:' + props.storageKey : null
let previewSettingsReady = false
function restorePreviewSettings() {
  if (previewSettingsKey) {
    try {
      const settings = JSON.parse(localStorage.getItem(previewSettingsKey) || 'null')
      if (settings?.version === 1) {
        if (['1024', '375', 'auto', 'custom'].includes(settings.width)) width.value = settings.width
        if (typeof settings.customWidth === 'number' && Number.isFinite(settings.customWidth)) customWidth.value = Math.round(Math.max(240, Math.min(1920, settings.customWidth)))
        if (typeof settings.fit === 'boolean') fit.value = settings.fit
      }
    } catch { /* Unavailable storage or old invalid preferences use the defaults. */ }
  }
  previewSettingsReady = true
}
function savePreviewSettings() {
  if (!previewSettingsReady || !previewSettingsKey) return
  try {
    localStorage.setItem(previewSettingsKey, JSON.stringify({ version: 1, width: width.value, customWidth: Math.round(Math.max(240, Math.min(1920, Number(customWidth.value) || 768))), fit: fit.value }))
  } catch { notice.value = '预览设置保存失败' }
}
// Persist synchronously so immediate navigation/reload cannot drop a selection.
watch([width, customWidth, fit], savePreviewSettings, { flush: 'sync' })
let resizeObserver
let worker, requestId = 0, renderTimer, deadline, saveTimer, loaded = false, active = true, restoreGeneration = 0
function ensureWorker() { if (!worker) { worker = new RenderWorker(); worker.onmessage = receive; worker.onerror = () => { clearTimeout(deadline); pending.value = false; error.value = { message: '预览引擎加载失败，请刷新页面重试', line: 1, column: 1 }; worker?.terminate(); worker = null } } }
function receive({ data: result }) {
  if (!active || result.id !== requestId) return
  clearTimeout(deadline); pending.value = false
  if (result.error) { error.value = result.error; return }
  error.value = null; warnings.value = result.warnings; stats.value = result.stats; renderedHtml.value = result.html
  const preview = buildPreview(result.html, result.css, { background: background.value, adapters: adapters.value, data: JSON.parse(json.value), componentId: props.storageKey }); srcdoc.value = preview.document; adapterNotes.value = preview.notes
}
function render() {
  if (!loaded || !active) return
  clearTimeout(deadline)
  let data
  try { data = JSON.parse(json.value); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('根节点必须是 JSON 对象') } catch (e) { requestId++; pending.value = false; error.value = { message: '示例数据错误：' + e.message, line: 1, column: 1, json: true }; return }
  ensureWorker(); const id = ++requestId; pending.value = true
  worker.postMessage({ id, template: template.value, css: css.value, data, strict: strict.value })
  deadline = setTimeout(() => { worker?.terminate(); worker = null; pending.value = false; error.value = { message: '渲染超过 2 秒，已停止。请减少循环或递归后重试。', line: 1, column: 1 } }, 2000)
}
function schedule() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 300) }
function snapshot() { return { version: 2, baseline, template: template.value, css: css.value, json: json.value, updatedAt: new Date().toISOString() } }
async function save() {
  if (!draftKey || !loaded) return
  const generation = restoreGeneration
  try { if (hasEdits()) await set(draftKey, snapshot()); else await del(draftKey); if (active && generation === restoreGeneration) saveState.value = '草稿已保存' } catch { if (active) saveState.value = '草稿保存失败' }
}
function scheduleSave() { if (!draftKey || !loaded) return; saveState.value = '正在保存…'; clearTimeout(saveTimer); saveTimer = setTimeout(save, 650) }
watch([template, css, json], () => { schedule(); scheduleSave() })
watch([strict, background, adapters], schedule)
onMounted(async () => {
  restorePreviewSettings()
  resizeObserver = new ResizeObserver(() => { if (canvas.value) { const style = getComputedStyle(canvas.value); canvasSize.value = { width: Math.max(240, canvas.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2), height: Math.max(180, canvas.value.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2) } } }); resizeObserver.observe(canvas.value)
  if (draftKey) {
    try { const draft = await get(draftKey); if (!active) return; const restored = migrateDraft(draft, baseline, props.previousFixtureHashes); if (restored) { template.value = restored.template; css.value = restored.css; json.value = restored.json; saveState.value = '草稿已恢复'; if (restored.fixtureUpdated) notice.value = '示例数据已更新' } } catch { saveState.value = '本地存储不可用' }
  }
  loaded = true; render()
})
async function restore() {
  restoreGeneration++; clearTimeout(saveTimer)
  template.value = props.template; css.value = props.css; json.value = JSON.stringify(props.data, null, 2); scenario.value = 'normal'; notice.value = '已恢复默认'
  if (draftKey) try { await del(draftKey) } catch { /* next save exposes storage failure */ }
  render(); scheduleSave()
}
function loadScenario() {
  const data = structuredClone(props.data)
  function visit(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) { if (scenario.value === 'empty') obj[k] = []; else v.forEach(x => x && typeof x === 'object' && visit(x)) }
      else if (v && typeof v === 'object') visit(v)
      else if (scenario.value === 'long' && /title/i.test(k) && typeof v === 'string') obj[k] = '这是一条用于检查换行、截断与响应式布局的超长标题——' + '让内容与设计在每一次探索中相遇。'.repeat(4)
    }
  }
  visit(data); json.value = JSON.stringify(data, null, 2)
}
function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportFiles() { download((props.storageKey || 'template') + '.json', JSON.stringify({ ...snapshot(), componentId: props.storageKey }, null, 2), 'application/json'); notice.value = '方案已导出' }
function exportCode() { download((props.storageKey || 'template') + '.ftl', template.value); setTimeout(() => download((props.storageKey || 'template') + '.css', css.value), 150); notice.value = '已导出 FTL 与 CSS 文件' }
async function importFile(event) {
  const file = event.target.files?.[0]; if (!file) return
  try { const draft = JSON.parse(await file.text()); if (typeof draft.template !== 'string' || typeof draft.css !== 'string' || typeof draft.json !== 'string') throw new Error('需要包含 template、css、json 字段的方案文件'); JSON.parse(draft.json); template.value = draft.template; css.value = draft.css; json.value = draft.json; notice.value = '方案已导入' } catch (e) { notice.value = '导入失败：' + e.message } finally { event.target.value = '' }
}
async function copy() {
  try { await navigator.clipboard.writeText(current.value); notice.value = '代码已复制' } catch { notice.value = '浏览器不允许复制，请选中代码手动复制' }
}
async function revealError() { tab.value = error.value.json ? 'json' : error.value.css ? 'css' : 'ftl'; await nextTick(); editor.value?.reveal(error.value.line, error.value.column) }
function insert(text) { tab.value = 'ftl'; setTimeout(() => editor.value?.insert(text), 0) }
defineExpose({ insert })
onBeforeUnmount(() => { active = false; resizeObserver?.disconnect(); clearTimeout(renderTimer); clearTimeout(saveTimer); clearTimeout(deadline); if (loaded && draftKey) void (hasEdits() ? set(draftKey, snapshot()) : del(draftKey)).catch(() => {}); worker?.terminate() })
</script>
<template>
  <section class="playground" :class="{ compact, 'is-fullscreen': fullscreen || previewOnly, 'preview-only': previewOnly }" aria-label="模板编辑与实时预览">
    <div class="playground-toolbar"><div><strong>模板编辑</strong></div><div class="toolbar-actions"><button @click="restore" title="恢复默认模板、CSS 与示例数据">↺ 恢复默认</button><button @click="importInput.click()">导入方案</button><button @click="exportFiles">保存方案 ↓</button><button class="export-button" @click="exportCode">导出代码 ↗</button><button v-if="previewOnly" @click="previewOnly = false">返回编辑</button><button v-else @click="fullscreen = !fullscreen" :aria-label="fullscreen ? '退出全屏' : '全屏编辑'">{{ fullscreen ? '收起' : '⛶' }}</button><input ref="importInput" type="file" accept="application/json,.json" hidden @change="importFile"></div></div>
    <div v-if="exampleTemplate" class="empty-template-notice"><span>默认模板为空。</span><button @click="template = exampleTemplate; tab = 'ftl'; notice = '已加载示例'">加载示例</button></div><div class="playground-panes">
      <section class="editor-pane" aria-label="代码编辑区"><div class="pane-tabs" role="tablist" aria-label="代码文件"><button v-for="t in [{ id: 'ftl', text: '模板 FTL', icon: '〈〉' }, { id: 'css', text: 'CSS', icon: '#' }, { id: 'json', text: '示例数据', icon: '{}' }]" :key="t.id" role="tab" :aria-selected="tab === t.id" :class="{ active: tab === t.id }" @click="tab = t.id"><span>{{ t.icon }}</span>{{ t.text }}</button><button class="copy-code" @click="copy" aria-label="复制当前代码">复制</button></div><CodeEditor ref="editor" v-model="current" :language="tab" :parameters="parameters" :error="error" /></section>
      <section class="preview-pane" aria-label="效果预览"><div class="preview-toolbar"><span>效果预览</span><div class="viewport-tools"><button :class="{ active: width === '1024' }" @click="width = '1024'" title="桌面 1024px">桌面</button><button :class="{ active: width === 'auto' }" @click="width = 'auto'" title="自适应宽度">自适应</button><button :class="{ active: width === '375' }" @click="width = '375'" title="手机 375px">手机</button><button :class="{ active: width === 'custom' }" @click="width = 'custom'">自定</button><input v-if="width === 'custom'" v-model="customWidth" type="number" min="240" max="1920" aria-label="预览宽度"><input v-model="background" type="color" title="预览背景色" aria-label="预览背景色"></div></div><div ref="canvas" class="preview-canvas"><div class="preview-frame-wrap" :style="{ width: previewWidth, height: canvasSize.height + 'px' }"><iframe v-if="srcdoc" :srcdoc="srcdoc" :style="iframeStyle" sandbox="" title="组件实时预览" referrerpolicy="no-referrer"></iframe><div v-else class="preview-empty">{{ error ? '暂无预览' : '加载中…' }}</div></div></div><div class="preview-foot"><span :class="pending ? 'render-pending' : error ? 'render-error' : stats ? 'render-success' : ''">{{ pending ? '正在渲染…' : error ? '渲染失败 · 保留上次效果' : stats ? '✓ 渲染完成' : '等待预览' }}</span><span v-if="stats && !pending">{{ logicalWidth }}px · {{ Math.round(previewScale * 100) }}%</span><button @click="fit = !fit">{{ fit ? '100% 查看' : '适应面板' }}</button><button @click="previewOnly = !previewOnly">{{ previewOnly ? '返回编辑' : '展开预览' }}</button><button @click="outputOpen = !outputOpen">{{ outputOpen ? '收起 HTML' : '查看 HTML' }}</button></div></section>
    </div>
    <div v-if="error" class="error-banner" role="alert"><strong>{{ error.json ? 'JSON' : error.css ? 'CSS' : 'FTL' }} 错误</strong><button @click="revealError">第 {{ error.line }} 行，第 {{ error.column }} 列</button><span>{{ error.message }}</span></div>
    <pre v-if="outputOpen" class="html-output"><code>{{ renderedHtml }}</code></pre>
    <div class="playground-options"><div><label>数据场景 <select v-model="scenario" @change="loadScenario"><option value="normal">正常内容</option><option value="empty">空列表</option><option value="long">超长标题</option></select></label><button class="reload-fixture" @click="json = JSON.stringify(props.data, null, 2); scenario = 'normal'; notice = '示例数据已更新'">更新示例数据</button><label class="strict-toggle"><input type="checkbox" v-model="adapters">示例补全</label><label class="strict-toggle"><input type="checkbox" v-model="strict">严格检查</label></div><span class="draft-state">{{ storageKey ? saveState : '' }}</span></div>
    <div v-if="notice" class="action-notice" role="status">{{ notice }}<button @click="notice = ''" aria-label="关闭提示">×</button></div>
  </section>
</template>
