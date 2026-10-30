import { adaptPreview, adapterCss } from './preview-adapters.mjs'
export function buildPreview(html, css, options = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const originalScriptCount = doc.querySelectorAll('script').length
  const originalIframes = [...doc.querySelectorAll('iframe')].map(el => el.getAttribute('src'))
  doc.querySelectorAll('script,iframe,object,embed,base,meta,link').forEach(el => el.remove())
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc', 'action', 'formaction'].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name)
      if (['href', 'src', 'xlink:href'].includes(attr.name.toLowerCase()) && /^\s*(javascript|vbscript):/i.test(attr.value)) el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') { el.removeAttribute('href'); el.style.cursor = 'default' }
    if (el.tagName === 'FORM') el.setAttribute('inert', '')
  })
  const notes = options.adapters === false ? [] : adaptPreview(doc, options.data || {}, options)
  const visible = doc.body.cloneNode(true)
  visible.querySelectorAll('style,script,[hidden],input[type="hidden"],[style*="display:none"],[style*="display: none"]').forEach(el => el.remove())
  const empty = !visible.textContent.trim() && !visible.querySelector('img[src],input:not([type=hidden]),select,textarea,canvas,svg')
  if (empty) {
    const message = doc.createElement('div'); message.className = 'boda-preview-empty'
    message.style.cssText = 'padding:28px 20px;border:1px dashed #ccd8c3;border-radius:6px;color:#809271;background:#f8faf4;font-size:13px;line-height:2;text-align:center'
    message.textContent = !html.trim() ? '模板为空。' : originalIframes.length ? '未配置嵌入地址。' : originalScriptCount ? '暂无内容。' : '暂无内容。'
    doc.body.append(message)
  }
  const csp = "default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'"
  const result = document.implementation.createHTMLDocument('组件预览')
  const meta = result.createElement('meta'); meta.httpEquiv = 'Content-Security-Policy'; meta.content = csp; result.head.append(meta)
  const charset = result.createElement('meta'); charset.setAttribute('charset', 'UTF-8'); result.head.prepend(charset)
  const viewport = result.createElement('meta'); viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1'; result.head.append(viewport)
  const style = result.createElement('style')
  style.textContent = `html{color-scheme:light}body{margin:0;padding:24px;background:${options.background || '#fff'};color:#243142;font-family:Arial,"Microsoft YaHei",sans-serif;font-size:14px;line-height:1.8;overflow-wrap:anywhere}*{box-sizing:border-box}a{color:#245eae}img{max-width:100%}table{max-width:100%}input,select,button{font:inherit}${options.adapters !== false ? adapterCss : ''}`
  result.head.append(style)
  doc.head.querySelectorAll('style').forEach(el => result.head.append(result.importNode(el, true)))
  const customStyle = result.createElement('style'); customStyle.textContent = css.replace(/<\/style/gi, '<\\/style'); result.head.append(customStyle)
  result.body.innerHTML = doc.body.innerHTML
  return { document: '<!doctype html>\n' + result.documentElement.outerHTML, notes, empty }
}
export function previewDocument(html, css, options) { return buildPreview(html, css, options).document }
