import { parseTemplate, TemplateError } from './parser.mjs'
import { evaluate, escapeHtml, dateFormat, numberFormat, forbidden } from './expression.mjs'
export { parseTemplate, TemplateError }
export { parseExpression } from './expression.mjs'
class BreakSignal { constructor(html = '') { this.html = html } }
export function locate(source, offset = 0) {
  const before = source.slice(0, offset); const lines = before.split('\n')
  return { line: lines.length, column: lines.at(-1).length + 1 }
}
export function renderTemplate(source, data = {}, options = {}) {
  const ast = parseTemplate(source); const warnings = new Set(); const globals = Object.assign(Object.create(null), data)
  const scopes = [globals]; const macros = new Map(); const nested = []; const started = Date.now()
  const settings = { locale: 'en-US', number_format: 'computer' }; let operations = 0, outputSize = 0, depth = 0
  const warn = message => { if (warnings.size < 100) warnings.add(message) }
  const mockFunctions = {
    v_link: path => { warn('v_link：保留原始资源地址，博达系统资源未连接'); return String(path) },
    v_media: (url, width, height, title = '') => { warn('v_media：使用图片模拟媒体输出'); return `<img src="${escapeHtml(url)}" width="${escapeHtml(width)}" height="${escapeHtml(height)}" alt="${escapeHtml(title)}" style="object-fit:cover;max-width:100%">` },
    v_includeJquery: () => { warn('v_includeJquery：预览中不加载博达 jQuery'); return '' },
    v_date: (date, format) => dateFormat(date, format)
  }
  const ctx = {
    settings, functions: { ...mockFunctions, ...options.functions },
    tick(offset = 0) {
      operations++
      if (operations > (options.maxOperations ?? 100000) || (operations % 1000 === 0 && Date.now() - started > (options.timeout ?? 1000))) throw new TemplateError('渲染超出执行限制，请减少循环或递归', offset)
    },
    lookup(name) { for (let i = scopes.length - 1; i >= 0; i--) if (Object.hasOwn(scopes[i], name)) return scopes[i][name]; return undefined },
    interpolate(value) { return run(parseTemplate(value)) }
  }
  const ev = node => evaluate(node, ctx)
  function add(result, text, offset) {
    outputSize += text.length
    if (outputSize > (options.maxOutput ?? 2000000)) throw new TemplateError('输出超过 2 MB 限制', offset)
    result.push(text)
  }
  function formatted(v, node) {
    if (v == null) {
      if (options.strict !== false) throw new TemplateError('变量或属性不存在，请补充示例数据或使用默认值 !', node.offset)
      warn(`第 ${locate(source, node.offset).line} 行：缺失数据已留空`); return ''
    }
    if (node.numeric && typeof v !== 'number') throw new TemplateError('#{} 需要数字', node.offset)
    if (node.format) {
      const min = Number(node.format.match(/m(\d+)/)?.[1] || 0); const max = Number(node.format.match(/M(\d+)/)?.[1] ?? (node.format.includes('m') ? min : 12))
      if (min > max || max > 20) throw new TemplateError('小数位数范围应为 0–20，且最小位数不能大于最大位数', node.offset)
      return new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: min, maximumFractionDigits: max }).format(v)
    }
    if (typeof v === 'boolean') {
      if (options.booleanFormat === 'c') { warn('预览环境将布尔值输出为 true/false'); return String(v) }
      if (settings.boolean_format) { const pair = settings.boolean_format.split(','); if (pair.length === 2) return v ? pair[0] : pair[1] }
      throw new TemplateError('布尔值请使用 ?string("是", "否") 或 ?c 输出', node.offset)
    }
    if (typeof v === 'number') return numberFormat(v, settings.number_format, settings)
    if (typeof v === 'object') throw new TemplateError('不能直接输出列表或对象，请选择属性或使用 list', node.offset)
    return String(v)
  }
  function run(nodes) {
    if (++depth > 100) throw new TemplateError('调用嵌套超过 100 层', nodes[0]?.offset)
    const result = []
    // Macros are available before declaration within a template.
    for (const n of nodes) if (n.type === 'macro') macros.set(n.name, n)
    try { for (const node of nodes) {
      ctx.tick(node.offset)
      try {
        switch (node.type) {
          case 'text': add(result, node.value, node.offset); break
          case 'output': add(result, formatted(ev(node.expr), node), node.offset); break
          case 'if': {
            let selected = node.otherwise
            for (const branch of node.branches) {
              const v = ev(branch.test)
              if (typeof v !== 'boolean') throw new TemplateError('if 条件必须是布尔值', branch.test.offset)
              if (v) { selected = branch.body; break }
            }
            add(result, run(selected), node.offset); break
          }
          case 'list': {
            let seq = ev(node.expr)
            if (seq == null && options.strict === false) { warn(`第 ${locate(source, node.offset).line} 行：缺失列表已按空列表处理`); seq = [] }
            if (!Array.isArray(seq)) throw new TemplateError('list 需要序列数据', node.offset)
            for (let i = 0; i < seq.length; i++) {
              ctx.tick(node.offset); scopes.push({ [node.name]: seq[i], [node.name + '_index']: i, [node.name + '_has_next']: i < seq.length - 1 })
              try { add(result, run(node.body), node.offset) } catch (e) { if (e instanceof BreakSignal) { add(result, e.html, node.offset); break; } throw e } finally { scopes.pop() }
            }
            break
          }
          case 'assign': for (const p of node.params) (node.local ? scopes.at(-1) : globals)[p.name] = ev(p.value); break
          case 'setting': for (const p of node.params) { if (!['locale', 'number_format', 'boolean_format'].includes(p.name)) throw new TemplateError(`暂不支持设置 ${p.name}`, node.offset); settings[p.name] = ev(p.value) } break
          case 'break': throw new BreakSignal()
          case 'switch': {
            const v = ev(node.expr); let start = node.cases.findIndex(c => c.test && ev(c.test) === v)
            if (start < 0) start = node.cases.findIndex(c => c.test === null)
            if (start >= 0) try { for (const c of node.cases.slice(start)) add(result, run(c.body), node.offset) } catch (e) { if (e instanceof BreakSignal) add(result, e.html, node.offset); else throw e }
            break
          }
          case 'macro': break
          case 'macroCall': {
            const macro = macros.get(node.name)
            if (!macro) throw new TemplateError(`未定义宏：${node.name}`, node.offset)
            const args = Object.create(null)
            for (const a of node.args) { if (!macro.params.some(p => p.name === a.name)) throw new TemplateError(`宏 ${node.name} 没有参数 ${a.name}`, node.offset); args[a.name] = ev(a.value) }
            const callerScopes = [...scopes]; const callerNested = [...nested]
            const ownScope = Object.create(null); scopes.splice(1, scopes.length - 1, ownScope)
            try {
              for (const p of macro.params) {
                if (Object.hasOwn(args, p.name)) ownScope[p.name] = args[p.name]
                else if (p.value) ownScope[p.name] = ev(p.value)
                else throw new TemplateError(`宏 ${node.name} 缺少参数 ${p.name}`, node.offset)
              }
              nested.push({ body: node.body, vars: node.vars, scopes: callerScopes, nested: callerNested })
              add(result, run(macro.body), node.offset)
            } finally { nested.splice(0, nested.length, ...callerNested); scopes.splice(0, scopes.length, ...callerScopes) }
            break
          }
          case 'nested': {
            const call = nested.at(-1)
            if (!call) throw new TemplateError('nested 只能在宏中使用', node.offset)
            const values = node.args.map(ev); const local = Object.create(null)
            call.vars.forEach((v, i) => { if (i < values.length && !forbidden(v)) local[v] = values[i] })
            const current = [...scopes], currentNested = [...nested]
            scopes.splice(0, scopes.length, ...call.scopes, local); nested.splice(0, nested.length, ...call.nested)
            try { add(result, run(call.body), node.offset) } finally { scopes.splice(0, scopes.length, ...current); nested.splice(0, nested.length, ...currentNested) }
            break
          }
        }
      } catch (error) {
        if (error instanceof BreakSignal) { error.html = result.join('') + error.html; throw error }
        if (error instanceof TemplateError) throw error
        throw new TemplateError(error.message, node.offset)
      }
    }
    return result.join('') } finally { depth-- }
  }
  try { return { html: run(ast), warnings: [...warnings], stats: { operations, milliseconds: Date.now() - started } } }
  catch (error) { if (error instanceof BreakSignal) throw new TemplateError('break 只能用于循环或 switch'); throw error }
}
