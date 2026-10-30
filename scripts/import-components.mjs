import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeTemplate } from './sanitize-content.mjs'
import { parseTemplate } from '../src/engine/index.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!process.argv[2]) { console.error('请提供组件资料目录：npm run import -- <目录>'); process.exit(1) }
const source = path.resolve(process.argv[2])
const out = path.join(root, 'docs/public/data'); fs.mkdirSync(out, { recursive: true })
const previousFixtureHashes = JSON.parse(fs.readFileSync(path.join(root, 'scripts/legacy-fixture-hashes.json'), 'utf8'))
const groups = new Map(), catalog = []
const componentOut = path.join(root, 'docs/data/components'); fs.mkdirSync(componentOut, { recursive: true })
const titles = ['把课堂搬进山野，让知识连接更广阔的世界', '校园开放日｜在这里，遇见新的可能', '关于举办青年学术交流活动的通知', '图书馆秋季阅读计划正式启动', '探索与创新：青年研究者的校园故事', '让每一份热爱，都有生长的土壤']
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#e8eef0"/><circle cx="500" cy="90" r="130" fill="#d4e1dc"/><path d="M0 400V270L180 110l220 290M170 400l220-230 250 230" fill="#91afa4"/><path d="M0 400V320l170-130 160 210M260 400l170-180 210 180" fill="#658979"/><text x="32" y="55" fill="#426454" font-size="20" font-family="sans-serif">IMAGE PREVIEW</text></svg>`
const picture = 'data:image/svg+xml,' + encodeURIComponent(svg)
const teacherPicture = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#e8eeea"/><circle cx="120" cy="100" r="47" fill="#a2b4a6"/><path d="M30 300v-45c0-100 180-100 180 0v45" fill="#819a89"/><text x="60" y="285" fill="#f1f5f0" font-size="13" font-family="sans-serif">TEACHER DEMO</text></svg>')
function valueFor(name, type, label = '') {
  if (type === 'Boolean') return !/isLast|isTop|hasAttach|hasExtend|hasPage|isHave|isSearchFreqFast/i.test(name)
  if (/^(width|height)$/i.test(name)) return name.toLowerCase() === 'width' ? 200 : 160
  if (type === 'Integer' || type === 'Number' || type === 'Long' || type === 'Float') return /col|row/i.test(name) ? 3 : /index/i.test(name) ? 0 : 6
  if (type === 'List') return []
  if (type === 'NumericString') return '30'
  if (/^(uid|UUID|uuid|formName|formname|uniqueClassName|wbserialnum|wbsearchcode)$/.test(name)) return 'boda_demo'
  if (/^(hidden|nohidden|target|cssTitleColor|titleColor|titlecolor|searchimg|videoUrl)$/.test(name) || /style$/i.test(name)) return ''
  if (/navOption/.test(name)) return '<option>全站内容</option><option>校园新闻</option>'
  if (/^(content|showContent|showRecontent)$/.test(name)) return '<p>这里是组件的示例正文。你可以修改模板结构和 CSS，实时观察内容排版的变化。</p><p>所有内容均为本地演示数据，可在“示例数据”中自由编辑。</p>'
  if (/(?:Id|ID)$/.test(name)) return 'demo_' + name
  if (/click|count|num/i.test(name) || /Times$/.test(name)) return '12'
  if (/pic|image|photo|logo|face|headimg|img/i.test(name) && !/width|height|size|count|isHave/i.test(name)) return picture
  if (/url|link|action/i.test(name) || type === 'URL') return '#preview'
  if (/date|time/i.test(name)) return /date$/i.test(name) && !/^show/.test(name) ? '2026-10-30 09:30:00' : '2026-10-30'
  if (/^siteName$/.test(name)) return '示例网站'
  if (/title/i.test(name)) return titles[0]
  if (/abstract|summary|intro/i.test(name)) return '在校园里记录发现，在探索中连接未来。这里是一段用于检查组件排版的示例摘要。'
  if (/column|treeName|moreName/i.test(name)) return '校园动态'
  if (/author|editor|account/i.test(name)) return '示例作者'
  if (/email/i.test(name)) return ''
  if (/phone|mobile|tel/i.test(name)) return ''
  if (/name/i.test(name)) return /file/i.test(name) ? '活动指南.pdf' : '示例名称'
  if (/click|count|size|number|num|^id$/i.test(name)) return '12'
  return label || '示例内容'
}
function makeFixture(template, params, id) {
  const data = Object.create(null), aliases = new Map(), types = new Map()
  for (const p of params) {
    if (p.kind !== 'parameter' || !p.parameter || ['Group', 'Function'].includes(p.type)) continue
    const direct = p.syntax?.match(/^\$\{\s*([\w.]+)\s*\}$/)
    if (direct) types.set(direct[1], { type: p.type, label: p.name })
    if (direct && !direct[1].includes('.')) data[direct[1]] = valueFor(p.parameter, p.type, p.name)
  }
  function resolve(node, env) {
    if (!node) return null
    if (node.type === 'variable') return env[node.value] || [node.value]
    if (node.type === 'access' && node.key.type === 'literal') { const base = resolve(node.target, env); return base && [...base, String(node.key.value)] }
    if (node.type === 'builtin' && ['chunk', 'reverse'].includes(node.name)) return resolve(node.target, env)
    return null
  }
  function ensure(keys, desired, exprName = keys?.join('.')) {
    if (!keys || keys.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) return
    let obj = data
    keys.forEach((k, i) => {
      if (i < keys.length - 1) { if (!obj[k] || typeof obj[k] !== 'object') obj[k] = keys[i + 1] === '0' ? [{}] : {}; obj = obj[k] }
      else {
        const spec = types.get(exprName)
        if (desired === 'List') { if (!Array.isArray(obj[k])) obj[k] = [{}]; if (!obj[k].length) obj[k].push({}) }
        else if (desired || obj[k] === undefined) obj[k] = valueFor(k, desired || spec?.type || 'String', spec?.label)
      }
    })
  }
  function expr(n, env, desired) {
    if (!n || typeof n !== 'object') return
    const resolved = resolve(n, env)
    if (resolved && !['builtin'].includes(n.type)) {
      const symbolic = n.type === 'access' ? symbolicPath(n) : n.value
      ensure(resolved, desired, symbolic); return
    }
    if (n.type === 'binary') {
      const arithmetic = ['+', '-', '*', '/', '%', '..', '<', '>', '<=', '>=', 'lt', 'gt', 'lte', 'gte'].includes(n.op)
      let kind = arithmetic ? 'Integer' : ['&&', '||', 'and', 'or'].includes(n.op) ? 'Boolean' : undefined
      if (n.right.type === 'string') kind = 'String'
      if (n.left.type === 'string') kind = 'String'
      if (n.right.type === 'literal') kind = typeof n.right.value === 'number' ? 'Integer' : typeof n.right.value === 'boolean' ? 'Boolean' : 'String'
      if (n.left.type === 'literal') kind = typeof n.left.value === 'number' ? 'Integer' : typeof n.left.value === 'boolean' ? 'Boolean' : 'String'
      expr(n.left, env, kind); expr(n.right, env, kind); return
    }
    if (n.type === 'unary') { expr(n.arg, env, n.op === '!' || n.op === 'not' ? 'Boolean' : 'Integer'); return }
    if (n.type === 'builtin') {
      expr(n.target, env, ['size', 'chunk', 'join', 'reverse'].includes(n.name) ? 'List' : n.name === 'number' ? 'NumericString' : undefined)
      n.args.forEach((a, i) => expr(a, env, n.name === 'chunk' && i === 0 ? 'Integer' : undefined)); return
    }
    if (n.type === 'call') { n.args.forEach(a => expr(a, env)); return }
    for (const val of Object.values(n)) if (Array.isArray(val)) val.forEach(x => expr(x, env)); else if (val && typeof val === 'object') expr(val, env)
  }
  function symbolicPath(n) { if (n.type === 'variable') return n.value; if (n.type === 'access' && n.key.type === 'literal') return symbolicPath(n.target) + '.' + n.key.value; return '' }
  function walk(nodes, env = {}) {
    for (const n of nodes) {
      if (n.type === 'list') {
        const keys = resolve(n.expr, env); ensure(keys, 'List')
        let item = keys ? [...keys, '0'] : null
        if (n.expr.type === 'builtin' && n.expr.name === 'chunk') item = keys // inner list iterates the chunk; alias points at original sequence
        const next = { ...env, ...(item ? { [n.name]: item } : {}) }; aliases.set(n.name, item)
        expr(n.expr, env); walk(n.body, next)
      } else if (n.type === 'if') { for (const b of n.branches) { expr(b.test, env, 'Boolean'); walk(b.body, env) } walk(n.otherwise, env) }
      else if (n.type === 'output') expr(n.expr, env)
    }
  }
  try { walk(parseTemplate(template)) } catch { /* Audit records syntax problems; importing raw materials must remain possible. */ }
  for (const [key, spec] of types) {
    const [alias, ...rest] = key.split('.')
    if (rest.length && aliases.get(alias)) ensure([...aliases.get(alias), ...rest], undefined, key)
  }
  function expand(obj, depth = 0, context = '') {
    if (depth > 8) return obj
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        if (!value.length) value.push({})
        if (typeof value[0] === 'object') {
          expand(value[0], depth + 1, key); const prototype = value[0]
          const count = /group|faculty/.test(key) ? 2 : /attach/.test(key) ? 2 : key === 'list_news' && context === 'list_group' ? 3 : /teacher/.test(key) ? 3 : 5
          obj[key] = Array.from({ length: count }, (_, i) => {
            const row = structuredClone(prototype)
            for (const k of Object.keys(row)) {
              if (/title/i.test(k) && typeof row[k] === 'string') row[k] = titles[i % titles.length]
              if (k === 'pos') row[k] = i + 1
              if (k === 'isFirst') row[k] = i === 0
              if (k === 'isLast') row[k] = i === count - 1
              if (k === 'isOdd') row[k] = i % 2 === 0
              if (k === 'isEven') row[k] = i % 2 !== 0
              if (k === 'isNew') row[k] = i < 2
              if (/(?:Id|ID)$/.test(k)) row[k] = 'demo_' + k + '_' + i
              if (/teacher/.test(key) && /^(showName|tipName|name)$/.test(k)) row[k] = ['陈明', '李文', '张晓'][i % 3]
              if (key === 'list_menu' && /title/i.test(k)) row[k] = ['首页', '校园动态', '通知公告', '人才培养', '关于我们'][i % 5]
              if (/college/.test(key) && /name/i.test(k)) row[k] = ['示例单位一', '示例单位二', '示例单位三', '示例单位四', '示例单位五'][i % 5]
            }
            if (row.picId) { if (!row.picurl || row.picurl === picture) row.picurl = teacherPicture; row.unit = ['示例单位一', '示例单位二', '示例单位五'][i % 3] }
            return row
          })
        }
      } else if (value && typeof value === 'object') expand(value, depth + 1)
    }
  }
  expand(data)
  let teacherSerial = 0
  function uniqueTeachers(node) { if (!node || typeof node !== 'object') return; if (node.picId) { node.picId = 'teacher_photo_' + (++teacherSerial); if (node.lineID) node.lineID = 'teacher_row_' + teacherSerial } Object.values(node).forEach(value => { if (value && typeof value === 'object') uniqueTeachers(value) }) }
  uniqueTeachers(data)
  if (data.list_group) { data.list_group.forEach((group, gi) => group.list_news?.forEach((news, ni) => { for (const key of ['showTitle', 'title', 'tipsTitle']) if (key in news) news[key] = titles[(gi * 3 + ni) % titles.length] })); data.colSize = 3; data.rowSize = 2; data.groupSize = 3; data.size = 6 }
  if (data.list_screens) { data.cur_code = 'pc'; data.list_screens = [{ name: '电脑版', code: 'pc', isCur: true, setDevice: '' }, { name: '手机版', code: 'mobile', isCur: false, setDevice: '' }] }
  if (Object.hasOwn(data, 'textArea')) data.textArea = '<h2>在这里，遇见校园的每一种可能</h2><p>这是超文本组件的示例内容，可以在示例数据中编辑 HTML。</p>'
  if ([44, 45, 46].includes(id)) Object.assign(data, { showTitle: '从这里开始设计你的组件', showAbstract: '这是独立的参考示例。修改 HTML 结构、CSS 和数据，创建自己的内容。' })
  if (id === 89) { data.title = '您对本次服务的评价？'; data.hidden2 = ''; data.list_xx = ['非常满意', '满意', '一般', '不满意'].map((showtitle, i) => ({ name: 'service_vote', id: 'vote_option_' + i, code: String(i + 1), showtitle })); data.list_result = ['非常满意', '满意', '一般', '不满意'].map((title, i) => ({ title, votecount: [72, 24, 16, 8][i], parresult: ['60%', '20%', '13.3%', '6.7%'][i] })); data.votetotlecount = 120 }
  if (id === 4) data._previewVisitCount = 1286
  if (id === 21) data._previewRelatedNews = titles.slice(0, 3).map(showTitle => ({ showTitle, picUrl: picture }))
  if (id === 8) Object.assign(data, { text: 'https://example.invalid/', width: 180, height: 180, correctlevel: 1, background: '#ffffff', foreground: '#146653', logo: '', elementRunMode: 0 })
  if (Object.hasOwn(data, 'startsearch')) data.startsearch = '搜索'
  if (Object.hasOwn(data, 'sitesearch')) data.sitesearch = '站内搜索'
  Object.assign(data, { uid: 'u_demo', uniqueClassName: 'c_demo', viewid: String(1000 + id) })
  return data
}
for (const dir of fs.readdirSync(source).sort()) {
  const base = path.join(source, dir), metaFile = path.join(base, 'metadata.json')
  if (!fs.existsSync(metaFile)) continue
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')), id = String(meta.index).padStart(3, '0')
  const parameters = JSON.parse(fs.readFileSync(path.join(base, 'parameters.json'), 'utf8')).map(parameter => Object.fromEntries(Object.entries(parameter).map(([key, value]) => [key, typeof value === 'string' ? sanitizeTemplate(value) : value])))
  const template = sanitizeTemplate(fs.readFileSync(path.join(base, 'template.ftl'), 'utf8')), css = fs.readFileSync(path.join(base, 'style.css'), 'utf8')
  const noDisplayMarkup = !template.replace(/<#--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*?-->/g, '').trim()
  const exampleTemplate = noDisplayMarkup && [44, 45, 46].includes(meta.index) ? '<section class="demo-card"><h2>${showTitle?html}</h2><p>${showAbstract?html}</p></section>' : !template.trim() ? '<ul class="teacher-demo">\n<#list teacherlist as teacher>\n<li><img src="${teacher.picurl}" width="120" height="150" alt="${teacher.showName}"><h3>${teacher.showName?html}</h3><p>${teacher.unit?html}</p></li>\n</#list>\n</ul>' : ''
  const item = { id, index: meta.index, name: meta.name, category: meta.category, parameterCount: parameters.filter(p => p.kind === 'parameter' && p.type !== 'Group').length, hasScript: /<script\b/i.test(template), templateLength: template.length }
  catalog.push(item)
  fs.writeFileSync(path.join(componentOut, id + '.json'), JSON.stringify({ ...item, parameters, template, exampleTemplate, previousFixtureHashes: previousFixtureHashes[id] || [], css, fixture: makeFixture(noDisplayMarkup ? exampleTemplate : template, parameters, meta.index) }, null, 2))
  const page = `---\ntitle: ${JSON.stringify(meta.name)}\ndescription: ${JSON.stringify('博达' + meta.name + '组件参数、模板与实时预览')}\nlayout: page\n---\n\n<script setup>\nimport item from '../data/components/${id}.json'\n</script>\n\n<ComponentPage :component="item" />\n`
  fs.writeFileSync(path.join(root, 'docs/components', id + '.md'), page)
  if (!groups.has(meta.category)) groups.set(meta.category, [])
  groups.get(meta.category).push({ text: meta.name, link: '/components/' + id })
}
fs.writeFileSync(path.join(root, 'docs/data/catalog.json'), JSON.stringify(catalog, null, 2))
fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog))
fs.writeFileSync(path.join(root, 'docs/data/sidebar.json'), JSON.stringify([...groups].map(([text, items]) => ({ text, collapsed: true, items })), null, 2))
console.log(`已导入 ${catalog.length} 个组件，${groups.size} 个分类。`)
