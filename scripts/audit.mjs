import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTemplate, renderTemplate, locate } from '../src/engine/index.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs/public/data')
const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'))
const rows = catalog.map(c => {
  const item = JSON.parse(fs.readFileSync(path.join(root, 'docs/data/components', c.id + '.json'), 'utf8'))
  const row = { id: c.id, name: c.name, category: c.category, parsed: false, rendered: false, strictRendered: false, warnings: [], error: null }
  try {
    parseTemplate(item.template); parseTemplate(item.css); row.parsed = true
    const result = renderTemplate(item.template, item.fixture, { strict: false, booleanFormat: 'c' }); const styles = renderTemplate(item.css, item.fixture, { strict: false, booleanFormat: 'c' }); row.rendered = true; row.warnings = [...new Set([...result.warnings, ...styles.warnings])]
    try { renderTemplate(item.template, item.fixture, { booleanFormat: 'c' }); renderTemplate(item.css, item.fixture); row.strictRendered = true } catch (e) { row.strictError = { message: e.message, ...locate(item.template, e.offset) } }
  } catch (e) { row.error = { message: e.message, ...locate(item.template, e.offset) } }
  return row
})
const report = { total: rows.length, parsed: rows.filter(r => r.parsed).length, rendered: rows.filter(r => r.rendered).length, strictRendered: rows.filter(r => r.strictRendered).length, rows }
fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(root, 'docs/data/audit.json'), JSON.stringify(report, null, 2))
console.log(`模板解析 ${report.parsed}/${report.total}；模拟渲染 ${report.rendered}/${report.total}；严格数据渲染 ${report.strictRendered}/${report.total}`)
for (const row of rows.filter(r => r.error)) console.log(`${row.id} ${row.name}：${row.error.message} (${row.error.line}:${row.error.column})`)
if (report.parsed !== report.total || report.rendered !== report.total) process.exitCode = 1
