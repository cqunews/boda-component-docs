import { ExpressionParser, parseExpression, TemplateError, forbidden } from './expression.mjs'
export { TemplateError } from './expression.mjs'
function scan(source) {
  const tokens = []; let i = 0
  const pattern = /\$\{|#\{|<#--|<\/?[#@]/g
  while (i < source.length) {
    pattern.lastIndex = i; const match = pattern.exec(source)
    if (!match) { tokens.push({ kind: 'text', value: source.slice(i), offset: i }); break }
    if (match.index > i) tokens.push({ kind: 'text', value: source.slice(i, match.index), offset: i })
    i = match.index
    if (match[0] === '<#--') {
      const end = source.indexOf('-->', i + 4)
      if (end < 0) throw new TemplateError('注释没有结束', i)
      i = end + 3; continue
    }
    const interpolation = match[0] === '${' || match[0] === '#{'
    const start = i; const contentStart = i + match[0].length
    let quote = '', depth = 0, end = -1
    for (let k = contentStart; k < source.length; k++) {
      const c = source[k]
      if (quote) { if (c === '\\') k++; else if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'") { quote = c; continue }
      if (source.startsWith('<#--', k)) {
        const close = source.indexOf('-->', k + 4)
        if (close < 0) throw new TemplateError('注释没有结束', k)
        k = close + 2; continue
      }
      if (depth === 0 && c === (interpolation ? '}' : '>')) { end = k; break }
      if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) { depth--; if (depth < 0) throw new TemplateError('括号不匹配', k) }
    }
    if (end < 0) throw new TemplateError(interpolation ? '插值没有结束' : '指令没有结束，请检查括号和引号', start)
    const content = source.slice(contentStart, end)
    if (interpolation) tokens.push({ kind: 'output', numeric: match[0] === '#{', value: content, offset: start, base: contentStart })
    else {
      const name = content.match(/^\s*([\w.]+)/)?.[1]
      if (!name) throw new TemplateError('指令名无效', start)
      const nameEnd = content.indexOf(name) + name.length
      const tail = content.slice(nameEnd); const trimmed = tail.replace(/\/\s*$/, '')
      tokens.push({ kind: match[0].includes('@') ? 'macroCall' : 'directive', closing: match[0].includes('/'), name, value: trimmed, selfClosing: /\/\s*$/.test(tail), base: contentStart + nameEnd, offset: start })
    }
    i = end + 1
  }
  return tokens
}
function declarations(source, base) {
  const p = new ExpressionParser(source, base); const params = []
  while (p.peek().type !== 'eof') {
    const t = p.take()
    if (t.type !== 'id' || forbidden(t.value)) throw new TemplateError('变量名无效', t.offset)
    const value = p.eat('=') ? p.expression() : null
    params.push({ name: t.value, value }); p.eat(',')
  }
  return params
}
export function parseTemplate(source) {
  const tokens = scan(source); let i = 0; let nesting = 0
  function body(stops = []) {
    if (++nesting > 150) throw new TemplateError('模板嵌套超过 150 层', tokens[i]?.offset)
    const nodes = []
    while (i < tokens.length) {
      const t = tokens[i]; const key = (t.closing ? '/' : '') + t.name
      if (stops.includes(key)) break
      i++
      if (t.kind === 'text') { nodes.push({ type: 'text', value: t.value, offset: t.offset }); continue }
      if (t.kind === 'output') {
        const p = new ExpressionParser(t.value, t.base); const expr = p.expression(); let format
        if (t.numeric && p.eat(';')) { format = t.value.slice(p.peek().offset - t.base).trim(); p.i = p.tokens.length - 1; if (!/^(m\d+)?(M\d+)?$/.test(format) || !format) throw new TemplateError('数字格式应为 m1、M2 或 m1M2', t.offset) }
        if (p.peek().type !== 'eof') throw new TemplateError(`多余的表达式内容：${p.peek().value}`, p.peek().offset)
        nodes.push({ type: 'output', expr, format, numeric: t.numeric, offset: t.offset }); continue
      }
      if (t.closing) throw new TemplateError(`没有对应的开始标记：${key}`, t.offset)
      if (t.kind === 'macroCall') {
        const p = new ExpressionParser(t.value, t.base); const args = []; const vars = []
        while (p.peek().type !== 'eof' && !p.peek(';')) {
          const k = p.take(); if (k.type !== 'id') throw new TemplateError('宏参数应使用 name=value', k.offset)
          p.expect('='); args.push({ name: k.value, value: p.expression() }); p.eat(',')
        }
        if (p.eat(';')) { do { const v = p.take(); if (v.type !== 'id') throw new TemplateError('循环变量名无效', v.offset); vars.push(v.value) } while (p.eat(',')) }
        if (p.peek().type !== 'eof') throw new TemplateError('宏调用参数无效', p.peek().offset)
        const children = t.selfClosing ? [] : body(['/' + t.name]); if (!t.selfClosing) close('/' + t.name, t)
        nodes.push({ type: 'macroCall', name: t.name, args, vars, body: children, offset: t.offset }); continue
      }
      switch (t.name) {
        case 'if': {
          const branches = [{ test: parseExpression(t.value, t.base), body: body(['elseif', 'else', '/if']) }]
          while (tokens[i]?.name === 'elseif' && !tokens[i].closing) { const e = tokens[i++]; branches.push({ test: parseExpression(e.value, e.base), body: body(['elseif', 'else', '/if']) }) }
          let otherwise = []
          if (tokens[i]?.name === 'else' && !tokens[i].closing) { i++; otherwise = body(['/if']) }
          close('/if', t); nodes.push({ type: 'if', branches, otherwise, offset: t.offset }); break
        }
        case 'list': {
          const p = new ExpressionParser(t.value, t.base); const expr = p.expression(); p.expect('as'); const v = p.take()
          if (v.type !== 'id' || forbidden(v.value) || p.peek().type !== 'eof') throw new TemplateError('list 语法应为 <#list 序列 as 变量>', t.offset)
          const children = body(['/list']); close('/list', t); nodes.push({ type: 'list', expr, name: v.value, body: children, offset: t.offset }); break
        }
        case 'assign': case 'local': {
          const params = declarations(t.value, t.base)
          if (!params.length || params.some(x => !x.value)) throw new TemplateError('赋值语法应为 name=表达式', t.offset)
          nodes.push({ type: 'assign', params, local: t.name === 'local', offset: t.offset }); break
        }
        case 'setting': {
          const params = declarations(t.value, t.base)
          if (!params.length || params.some(x => !x.value)) throw new TemplateError('设置语法应为 name=值', t.offset)
          nodes.push({ type: 'setting', params, offset: t.offset }); break
        }
        case 'break': nodes.push({ type: 'break', offset: t.offset }); break
        case 'macro': {
          const name = t.value.match(/^\s*([\w]+)/)?.[1]
          if (!name || forbidden(name)) throw new TemplateError('宏名称无效', t.offset)
          const skip = t.value.indexOf(name) + name.length; const params = declarations(t.value.slice(skip), t.base + skip)
          const children = body(['/macro']); close('/macro', t)
          nodes.push({ type: 'macro', name, params, body: children, offset: t.offset }); break
        }
        case 'nested': {
          const p = new ExpressionParser(t.value, t.base); const args = []
          if (p.peek().type !== 'eof') do { args.push(p.expression()) } while (p.eat(','))
          if (p.peek().type !== 'eof') throw new TemplateError('nested 参数无效', p.peek().offset)
          nodes.push({ type: 'nested', args, offset: t.offset }); break
        }
        case 'switch': {
          const expr = parseExpression(t.value, t.base); const prelude = body(['case', 'default', '/switch'])
          if (prelude.some(x => x.type !== 'text' || x.value.trim())) throw new TemplateError('switch 内容需要放在 case/default 之后', t.offset)
          const cases = []
          while (tokens[i] && !tokens[i].closing && ['case', 'default'].includes(tokens[i].name)) {
            const c = tokens[i++]; cases.push({ test: c.name === 'default' ? null : parseExpression(c.value, c.base), body: body(['case', 'default', '/switch']) })
          }
          close('/switch', t); nodes.push({ type: 'switch', expr, cases, offset: t.offset }); break
        }
        default: throw new TemplateError(`暂不支持指令 <#${t.name}>`, t.offset)
      }
    }
    nesting--; return nodes
  }
  function close(name, start) {
    const t = tokens[i]
    if (!t || (t.closing ? '/' : '') + t.name !== name) throw new TemplateError(`缺少 <${name.startsWith('/') ? '/' : ''}#${name.replace('/', '')}>，请检查嵌套`, start.offset)
    i++
  }
  return body()
}
