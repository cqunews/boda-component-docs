// A deliberately interpreted expression language. No JavaScript evaluation.
export class TemplateError extends Error {
  constructor(message, offset = 0) { super(message); this.name = 'TemplateError'; this.offset = offset }
}
const blocked = new Set(['__proto__', 'prototype', 'constructor', 'caller', 'callee', 'arguments'])
export const forbidden = name => blocked.has(String(name))
export function lex(source, base = 0) {
  const tokens = []; let i = 0
  const add = (type, value, start) => tokens.push({ type, value, offset: base + start })
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue }
    const start = i
    if (source.startsWith('<#--', i)) {
      const end = source.indexOf('-->', i + 4)
      if (end < 0) throw new TemplateError('注释没有结束', base + i)
      i = end + 3; continue
    }
    const raw = source[i] === 'r' && /["']/.test(source[i + 1] || '')
    if (raw || source[i] === '"' || source[i] === "'") {
      if (raw) i++
      const quote = source[i++]; let value = ''; let closed = false
      while (i < source.length) {
        const ch = source[i++]
        if (ch === quote) { closed = true; break }
        if (ch === '\\' && !raw) {
          const e = source[i++]; const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', l: '<', g: '>', a: '&', '\\': '\\', '"': '"', "'": "'", '{': '{' }
          if (e === 'x') {
            const hex = source.slice(i).match(/^[0-9a-fA-F]{1,4}/)?.[0]
            if (!hex) throw new TemplateError('无效的 Unicode 转义', base + i)
            value += String.fromCharCode(parseInt(hex, 16)); i += hex.length
          } else if (Object.hasOwn(escapes, e)) value += escapes[e]
          else throw new TemplateError(`无效转义：\\${e}`, base + i - 2)
        } else value += ch
      }
      if (!closed) throw new TemplateError('字符串没有结束', base + start)
      add(raw ? 'raw' : 'string', value, start); continue
    }
    const num = source.slice(i).match(/^\d+(?:\.(?!\.)\d+)?/)
    if (num) { i += num[0].length; add('number', Number(num[0]), start); continue }
    const id = source.slice(i).match(/^[\p{L}_$][\p{L}\p{N}_$]*/u)
    if (id) { i += id[0].length; add('id', id[0], start); continue }
    const op = ['??', '..', '==', '!=', '<=', '>=', '&&', '||'].find(x => source.startsWith(x, i))
    if (op) { i += op.length; add('op', op, start); continue }
    if ('+-*/%=!<>?.:,()[]{};'.includes(source[i])) { add('op', source[i++], start); continue }
    throw new TemplateError(`无法识别的字符：${source[i]}`, base + i)
  }
  tokens.push({ type: 'eof', value: '', offset: base + source.length }); return tokens
}
const priorities = { '!': 1, '||': 2, or: 2, '&&': 3, and: 3, '=': 4, '==': 4, '!=': 4, '<': 5, '>': 5, '<=': 5, '>=': 5, lt: 5, gt: 5, lte: 5, gte: 5, '..': 6, '+': 7, '-': 7, '*': 8, '/': 8, '%': 8 }
export class ExpressionParser {
  constructor(source, base = 0) { this.tokens = lex(source, base); this.i = 0 }
  peek(value) { return value === undefined ? this.tokens[this.i] : this.tokens[this.i].value === value }
  take() { return this.tokens[this.i++] }
  eat(v) { if (this.peek(v)) { this.take(); return true } return false }
  expect(v) { if (!this.eat(v)) throw new TemplateError(`此处需要 ${v}`, this.peek().offset) }
  expression(min = 0) {
    let a = this.primary()
    while (true) {
      const t = this.peek(); const op = t.value; const prec = priorities[op]
      if (prec === undefined || prec < min) break
      this.take()
      if (op === '!' && (this.peek().type === 'eof' || [')', ']', '}', ',', ';'].includes(this.peek().value))) {
        a = { type: 'default', left: a, right: { type: 'literal', value: '', offset: t.offset }, offset: t.offset }; continue
      }
      const b = this.expression(op === '!' ? prec : prec + 1)
      a = { type: op === '!' ? 'default' : 'binary', op, left: a, right: b, offset: t.offset }
    }
    return a
  }
  primary() {
    const t = this.take(); let a
    if (t.type === 'number' || t.type === 'raw') a = { type: 'literal', value: t.value, offset: t.offset }
    else if (t.type === 'string') a = { type: 'string', value: t.value, offset: t.offset }
    else if (['!', '-', '+', 'not'].includes(t.value)) a = { type: 'unary', op: t.value, arg: this.expression(9), offset: t.offset }
    else if (t.value === '(') { a = this.expression(); this.expect(')') }
    else if (t.value === '[') {
      const values = []
      if (!this.eat(']')) { do { values.push(this.expression()) } while (this.eat(',')); this.expect(']') }
      a = { type: 'array', values, offset: t.offset }
    } else if (t.value === '{') {
      const values = []
      if (!this.eat('}')) {
        do { const k = this.expression(); this.expect(':'); const v = this.expression(); values.push([k, v]) } while (this.eat(','))
        this.expect('}')
      }
      a = { type: 'hash', values, offset: t.offset }
    } else if (t.type === 'id') a = { type: ['true', 'false'].includes(t.value) ? 'literal' : 'variable', value: t.value === 'true' ? true : t.value === 'false' ? false : t.value, offset: t.offset }
    else throw new TemplateError('缺少有效的表达式', t.offset)
    while (true) {
      if (this.eat('.')) {
        const key = this.take()
        if (key.type !== 'id') throw new TemplateError('属性名无效', key.offset)
        if (a.type === 'builtin' && a.name === 'string' && !a.args.length) a = { ...a, args: [{ type: 'literal', value: key.value, offset: key.offset }] }
        else a = { type: 'access', target: a, key: { type: 'literal', value: key.value, offset: key.offset }, offset: key.offset }
      } else if (this.eat('[')) {
        const key = this.expression(); this.expect(']'); a = { type: 'access', target: a, key, offset: key.offset }
      } else if (this.eat('??')) a = { type: 'exists', arg: a, offset: t.offset }
      else if (this.eat('?')) {
        const name = this.take()
        if (name.type !== 'id') throw new TemplateError('内建函数名无效', name.offset)
        const args = this.eat('(') ? this.args() : []
        a = { type: 'builtin', target: a, name: name.value, args, offset: name.offset }
      } else if (this.eat('(')) a = { type: 'call', target: a, args: this.args(), offset: t.offset }
      else break
    }
    return a
  }
  args() {
    const args = []
    if (!this.eat(')')) { do { args.push(this.expression()) } while (this.eat(',')); this.expect(')') }
    return args
  }
  all() { const a = this.expression(); if (this.peek().type !== 'eof') throw new TemplateError(`多余的内容：${this.peek().value}`, this.peek().offset); return a }
}
export function parseExpression(source, base = 0) { return new ExpressionParser(source, base).all() }
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export function dateFormat(value, pattern = 'yyyy-MM-dd') {
  const d = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) throw new Error(`无效日期：${value}`)
  const vals = { yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(-2), MMMM: d.toLocaleString('en-US', { month: 'long' }), MMM: d.toLocaleString('en-US', { month: 'short' }), MM: String(d.getMonth() + 1).padStart(2, '0'), M: d.getMonth() + 1, dd: String(d.getDate()).padStart(2, '0'), d: d.getDate(), HH: String(d.getHours()).padStart(2, '0'), H: d.getHours(), hh: String(d.getHours() % 12 || 12).padStart(2, '0'), h: d.getHours() % 12 || 12, mm: String(d.getMinutes()).padStart(2, '0'), m: d.getMinutes(), ss: String(d.getSeconds()).padStart(2, '0'), s: d.getSeconds(), EEEE: d.toLocaleString('en-US', { weekday: 'long' }), EEE: d.toLocaleString('en-US', { weekday: 'short' }) }
  let quoted = false, out = ''
  for (let i = 0; i < pattern.length;) {
    if (pattern[i] === "'") { if (pattern[i + 1] === "'") { out += "'"; i += 2 } else { quoted = !quoted; i++ } continue }
    const key = !quoted && Object.keys(vals).find(k => pattern.startsWith(k, i))
    if (key) { out += vals[key]; i += key.length } else out += pattern[i++]
  }
  return out
}
export function numberFormat(value, pattern = 'number', settings = {}) {
  if (pattern === 'computer' || pattern === 'c') return String(value)
  const locale = (settings.locale || 'en-US').replace('_', '-')
  if (pattern === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: locale.startsWith('zh') ? 'CNY' : 'USD' }).format(value)
  if (pattern === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 3 }).format(value)
  if (pattern === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(value)
  const m = pattern.match(/^(#,##)?0(?:\.([0#]+))?$/) || pattern.match(/^(#)(?:\.([0#]+))?$/)
  if (!m) throw new Error(`暂不支持数字格式：${pattern}`)
  const fraction = m[2] || ''
  return new Intl.NumberFormat(locale, { useGrouping: pattern.includes(','), minimumFractionDigits: (fraction.match(/0/g) || []).length, maximumFractionDigits: fraction.length }).format(value)
}
export function evaluate(node, ctx) {
  ctx.tick(node.offset)
  const ev = n => evaluate(n, ctx)
  const fail = message => { throw new TemplateError(message, node.offset) }
  const required = value => value === undefined || value === null ? fail('变量或属性不存在') : value
  const bool = value => typeof value === 'boolean' ? value : fail('条件和逻辑运算必须使用布尔值')
  switch (node.type) {
    case 'literal': return node.value
    case 'string': return node.value.includes('${') || node.value.includes('#{') ? ctx.interpolate(node.value) : node.value
    case 'variable': return forbidden(node.value) ? fail('不能访问该属性') : ctx.lookup(node.value)
    case 'access': {
      const target = ev(node.target), key = ev(node.key)
      if (forbidden(key)) return fail('不能访问该属性')
      if (target == null) return undefined
      return Object.hasOwn(Object(target), key) ? target[key] : undefined
    }
    case 'array': return node.values.map(ev)
    case 'hash': {
      const result = Object.create(null)
      for (const [k, v] of node.values) { const key = ev(k); if (typeof key !== 'string' || forbidden(key)) return fail('散列的键必须是安全的字符串'); result[key] = ev(v) }
      return result
    }
    case 'exists': return ev(node.arg) != null
    case 'default': { const v = ev(node.left); return v == null ? ev(node.right) : v }
    case 'unary': { const v = required(ev(node.arg)); if (node.op === '!' || node.op === 'not') return !bool(v); if (typeof v !== 'number') return fail('算术运算必须使用数字'); return node.op === '-' ? -v : v }
    case 'binary': {
      const a = required(ev(node.left)); const op = node.op
      if (op === '&&' || op === 'and') return bool(a) && bool(required(ev(node.right)))
      if (op === '||' || op === 'or') return bool(a) || bool(required(ev(node.right)))
      const b = required(ev(node.right))
      if (['=', '==', '!='].includes(op)) { if (typeof a !== typeof b) return fail('比较值必须具有相同类型'); return op === '!=' ? a !== b : a === b }
      if (op === '+' && (typeof a === 'string' || typeof b === 'string')) return String(a) + String(b)
      if (typeof a !== 'number' || typeof b !== 'number') return fail('此运算必须使用数字')
      if (['<', 'lt'].includes(op)) return a < b
      if (['>', 'gt'].includes(op)) return a > b
      if (['<=', 'lte'].includes(op)) return a <= b
      if (['>=', 'gte'].includes(op)) return a >= b
      if (op === '..') { if (!Number.isInteger(a) || !Number.isInteger(b)) return fail('范围端点必须是整数'); if (Math.abs(b - a) > 10000) return fail('范围超过 10000 项上限'); return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => a + i * (b >= a ? 1 : -1)) }
      if (op === '+') return a + b
      if (op === '-') return a - b
      if (op === '*') return a * b
      if ((op === '/' || op === '%') && b === 0) return fail('不能除以零')
      if (op === '/') return a / b
      if (op === '%') return Math.trunc(a) % Math.trunc(b)
      return fail(`暂不支持运算符 ${op}`)
    }
    case 'call': {
      // Only named, registered helpers may be called; no object or global methods.
      if (node.target.type !== 'variable' || !Object.hasOwn(ctx.functions, node.target.value)) return fail('只能调用已注册的模板函数')
      return ctx.functions[node.target.value](...node.args.map(ev))
    }
    case 'builtin': {
      const v = ev(node.target), name = node.name, args = node.args.map(ev)
      if (name === 'has_content') return v != null && (typeof v === 'object' ? Object.keys(v).length > 0 : String(v).length > 0)
      if (name === 'exists') return v != null
      if (name === 'default') return v == null ? args[0] ?? '' : v
      required(v)
      switch (name) {
        case 'size': if (Array.isArray(v) || typeof v === 'string') return v.length; if (typeof v === 'object') return Object.keys(v).length; return fail('?size 需要序列、字符串或散列')
        case 'chunk': {
          if (!Array.isArray(v) || !Number.isInteger(args[0]) || args[0] < 1) return fail('?chunk 需要序列和正整数')
          const chunks = []
          for (let i = 0; i < v.length; i += args[0]) { ctx.tick(node.offset); const chunk = v.slice(i, i + args[0]); if (args.length > 1) while (chunk.length < args[0]) { ctx.tick(node.offset); chunk.push(args[1]) } chunks.push(chunk) }
          return chunks
        }
        case 'html': return escapeHtml(v)
        case 'no_esc': return String(v)
        case 'upper_case': return String(v).toUpperCase()
        case 'lower_case': return String(v).toLowerCase()
        case 'cap_first': return String(v).replace(/\S/, c => c.toUpperCase())
        case 'trim': return String(v).trim()
        case 'int': if (typeof v !== 'number') return fail('?int 需要数字'); return Math.trunc(v)
        case 'number': { const n = Number(v); if (typeof v !== 'string' || !v.trim() || !Number.isFinite(n)) return fail('?number 需要有效数字字符串'); return n }
        case 'c': return typeof v === 'boolean' || typeof v === 'number' ? String(v) : fail('?c 需要数字或布尔值')
        case 'join': return Array.isArray(v) ? v.join(args[0] ?? '') : fail('?join 需要序列')
        case 'reverse': return Array.isArray(v) ? [...v].reverse() : fail('?reverse 需要序列')
        case 'replace': return String(v).split(String(args[0])).join(String(args[1]))
        case 'contains': return String(v).includes(String(args[0]))
        case 'keys': return Object.keys(v)
        case 'string': {
          if (typeof v === 'boolean') return args.length === 2 ? (v ? args[0] : args[1]) : String(v)
          if (typeof v === 'number') return numberFormat(v, args[0] || ctx.settings.number_format || 'number', ctx.settings)
          if (args[0]) return dateFormat(v, args[0])
          return String(v)
        }
        default: return fail(`暂不支持内建函数 ?${name}`)
      }
    }
    default: return fail(`未知表达式 ${node.type}`)
  }
}
