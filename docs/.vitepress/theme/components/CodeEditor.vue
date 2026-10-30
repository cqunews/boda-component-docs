<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ modelValue: String, language: String, parameters: { type: Array, default: () => [] }, error: Object })
const emit = defineEmits(['update:modelValue'])
const host = ref(), plain = ref(false), ready = ref(false), loadError = ref('')
let editor, monaco, observer, completion, disposed = false
const models = new Map()
function modelFor(language, content) {
  if (!models.has(language)) models.set(language, monaco.editor.createModel(content || '', language === 'ftl' ? 'boda-ftl' : language))
  return models.get(language)
}
function markers() {
  if (!editor) return
  const error = props.error && props.language === (props.error.json ? 'json' : props.error.css ? 'css' : 'ftl') ? props.error : null
  monaco.editor.setModelMarkers(editor.getModel(), 'boda', error ? [{ startLineNumber: error.line || 1, startColumn: error.column || 1, endLineNumber: error.line || 1, endColumn: (error.column || 1) + 1, message: error.message, severity: monaco.MarkerSeverity.Error }] : [])
}
watch(() => props.language, lang => {
  if (editor) { editor.setModel(modelFor(lang, props.modelValue)); if (editor.getValue() !== props.modelValue) editor.setValue(props.modelValue || ''); markers() }
})
watch(() => props.modelValue, value => { if (editor && editor.getValue() !== value) editor.setValue(value || '') })
watch(() => props.error, markers)
watch(plain, () => { if (!plain.value) requestAnimationFrame(() => editor?.layout()) })
onMounted(async () => {
  try {
    const [api, { default: EditorWorker }, { default: CssWorker }, { default: HtmlWorker }, { default: JsonWorker }] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker')
    ])
    if (disposed) return
    monaco = api
    self.MonacoEnvironment = { getWorker(_, label) { return label === 'css' ? new CssWorker() : label === 'html' ? new HtmlWorker() : label === 'json' ? new JsonWorker() : new EditorWorker() } }
    await Promise.all([import('monaco-editor/esm/vs/language/css/monaco.contribution'), import('monaco-editor/esm/vs/language/html/monaco.contribution'), import('monaco-editor/esm/vs/language/json/monaco.contribution')])
    if (disposed) return
    if (!monaco.languages.getLanguages().some(x => x.id === 'boda-ftl')) {
      monaco.languages.register({ id: 'boda-ftl' })
      monaco.languages.setMonarchTokensProvider('boda-ftl', { tokenizer: { root: [[/<#--/, 'comment', '@comment'], [/<\/?[#@][\w.]+/, 'keyword'], [/\$\{|#\{/, 'delimiter.bracket', '@expression'], [/<\/?[\w-]+/, 'tag'], [/\b[\w-]+(?==)/, 'attribute.name'], [/"[^"]*"|'[^']*'/, 'string'], [/>/, 'tag']] , comment: [[/-->/, 'comment', '@pop'], [/./, 'comment']], expression: [[/}/, 'delimiter.bracket', '@pop'], [/[\w.]+/, 'variable'], [/./, 'keyword']] } })
    }
    monaco.editor.defineTheme('boda-light', { base: 'vs', inherit: true, rules: [{ token: 'keyword', foreground: '187360' }, { token: 'variable', foreground: '99612F' }, { token: 'tag', foreground: '366D96' }, { token: 'comment', foreground: '8E9897' }], colors: { 'editor.background': '#FCFDFD', 'editorLineNumber.foreground': '#AFB9B6', 'editor.lineHighlightBackground': '#F2F6F4', 'editor.selectionBackground': '#D6E8DF', 'editorCursor.foreground': '#146653' } })
    editor = monaco.editor.create(host.value, { model: modelFor(props.language, props.modelValue), theme: 'boda-light', fontSize: 13, lineHeight: 23, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', minimap: { enabled: false }, automaticLayout: false, scrollBeyondLastLine: false, tabSize: 2, wordWrap: 'on', padding: { top: 16, bottom: 16 }, fixedOverflowWidgets: true, ariaLabel: '模板代码编辑器', renderLineHighlight: 'gutter', overviewRulerLanes: 0, hideCursorInOverviewRuler: true })
    editor.onDidChangeModelContent(() => emit('update:modelValue', editor.getValue()))
    completion = monaco.languages.registerCompletionItemProvider('boda-ftl', { triggerCharacters: ['$', '.', '?'], provideCompletionItems(model, position) {
      if (![...models.values()].includes(model)) return { suggestions: [] }
      const word = model.getWordUntilPosition(position); const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn }
      return { suggestions: props.parameters.filter(p => p.parameter && p.type !== 'Group').map(p => ({ label: p.parameter, detail: `${p.type} · ${p.name}`, documentation: p.description || '', kind: monaco.languages.CompletionItemKind.Variable, insertText: p.parameter, range })) }
    } })
    observer = new ResizeObserver(() => editor?.layout()); observer.observe(host.value)
    ready.value = true; markers()
  } catch (e) { if (!disposed) { loadError.value = '已切换为简洁编辑器'; plain.value = true } }
})
function insert(text) {
  if (!editor || plain.value) { emit('update:modelValue', (props.modelValue || '') + '\n' + text); return }
  editor.executeEdits('parameter', [{ range: editor.getSelection(), text, forceMoveMarkers: true }]); editor.focus()
}
function reveal(line, column) { if (editor && !plain.value) { editor.revealPositionInCenter({ lineNumber: line, column }); editor.setPosition({ lineNumber: line, column }); editor.focus() } }
defineExpose({ insert, reveal })
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); completion?.dispose(); editor?.dispose(); models.forEach(m => m.dispose()) })
</script>
<template>
  <div class="code-editor">
    <div v-show="!plain" ref="host" class="monaco-host"></div>
    <textarea v-if="plain" :value="modelValue" @input="emit('update:modelValue', $event.target.value)" class="plain-code" :aria-label="language === 'ftl' ? '模板代码' : language === 'css' ? 'CSS 代码' : '示例数据 JSON'" spellcheck="false"></textarea>
    <div v-if="!ready && !plain" class="editor-loading">正在载入编辑器…</div>
    <div class="editor-foot"><span>{{ language === 'ftl' ? 'FreeMarker 模板' : language === 'css' ? 'CSS 样式表' : 'JSON 示例数据' }} <i>·</i> {{ (modelValue || '').split('\n').length }} 行</span><button @click="plain = !plain" :aria-pressed="plain">{{ plain ? '代码编辑器' : '简洁编辑' }}</button><span v-if="loadError">{{ loadError }}</span></div>
  </div>
</template>
