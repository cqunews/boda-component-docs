import fs from 'node:fs'
import { Window } from 'happy-dom'
import { renderTemplate } from '../src/engine/index.mjs'
import { buildPreview } from '../src/preview.mjs'
const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true, disableIframePageLoading: true } })
globalThis.DOMParser = window.DOMParser; globalThis.document = window.document
const catalog = JSON.parse(fs.readFileSync(new URL('../docs/data/catalog.json', import.meta.url)))
const rows = catalog.map(c => {
  const item = JSON.parse(fs.readFileSync(new URL(`../docs/data/components/${c.id}.json`, import.meta.url)))
  const html = renderTemplate(item.template, item.fixture, { booleanFormat: 'c' }).html
  const css = renderTemplate(item.css, item.fixture).html
  const result = buildPreview(html, css, { data: item.fixture, componentId: c.id })
  const doc = new DOMParser().parseFromString(result.document, 'text/html')
  const invalidImages = [...doc.querySelectorAll('img')].filter(img => !/^(data:|blob:|https?:|\/\/)/i.test(img.getAttribute('src') || '')).length
  return { id: c.id, name: c.name, originalEmpty: !item.template.trim(), previewEmpty: result.empty, adaptations: result.notes, invalidImages, images: doc.querySelectorAll('img').length }
})
const report = { total: rows.length, originalEmpty: rows.filter(r => r.originalEmpty).length, previewEmpty: rows.filter(r => r.previewEmpty).length, invalidImages: rows.reduce((n, r) => n + r.invalidImages, 0), adapted: rows.filter(r => r.adaptations.length).length, rows }
fs.writeFileSync(new URL('../docs/data/preview-audit.json', import.meta.url), JSON.stringify(report, null, 2))
console.log(`预览 DOM 检查 ${report.total} 项；无地址图片 ${report.invalidImages}；原始空模板 ${report.originalEmpty}；无静态内容 ${report.previewEmpty}；演示适配 ${report.adapted} 项`)
for (const row of rows.filter(r => r.previewEmpty)) console.log(`${row.id} ${row.name}: ${row.originalEmpty ? '默认模板为空，提供参考模板' : '内容依赖脚本或当前条件，提供明确空状态'}`)
if (report.invalidImages) process.exitCode = 1
