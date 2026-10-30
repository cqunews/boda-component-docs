import qrcode from 'qrcode-generator'
const svgData = svg => 'data:image/svg+xml,' + encodeURIComponent(svg)
export const placeholderImage = svgData('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#e8efe5"/><path d="M0 400V290L180 110l220 290M240 400l180-200 220 200" fill="#9cb793"/><circle cx="500" cy="80" r="35" fill="#c7d9bb"/><text x="24" y="44" font-size="18" fill="#607d56" font-family="sans-serif">IMAGE PREVIEW</text></svg>')
const portrait = svgData('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#e8eeea"/><circle cx="120" cy="100" r="47" fill="#a2b4a6"/><path d="M30 300v-45c0-100 180-100 180 0v45" fill="#819a89"/><text x="60" y="285" fill="#f1f5f0" font-size="13" font-family="sans-serif">TEACHER DEMO</text></svg>')
function records(data) {
  const rows = []; const visit = x => { if (!x || typeof x !== 'object') return; if (!Array.isArray(x)) rows.push(x); Object.values(x).forEach(v => { if (v && typeof v === 'object') visit(v) }) }
  visit(data); return rows
}
export function adaptPreview(doc, data, options = {}) {
  const notes = [], rows = records(data), teachers = rows.filter(r => r.picId)
  let backgrounds = 0
  for (const el of doc.querySelectorAll('[style]')) {
    const original = el.getAttribute('style') || ''
    if (/background-image\s*:\s*url\([^)]*\/system\//i.test(original)) {
      let adjusted = original.replace(/background-image\s*:\s*url\([^)]*\/system[^)]*\)\s*;?/gi, 'background-image:none;'); backgrounds++
      if (/(?:^|;)\s*color\s*:\s*(?:#fff(?:fff)?|white|rgba?\(255,\s*255,\s*255(?:,\s*1)?\))\s*(?:;|$)/i.test(original)) adjusted += ';background-color:#52734d'
      el.setAttribute('style', adjusted)
    }
  }
  if (backgrounds) notes.push(`${backgrounds} 处原站背景图未连接，已移除；白色文字区域使用演示底色`)
  let filled = 0, replaced = 0
  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src')?.trim()
    const row = teachers.find(r => r.picId === img.id)
    if (!src && row) {
      img.setAttribute('src', /^(https?:|data:|blob:)/i.test(row.picurl || '') ? row.picurl : portrait)
      img.setAttribute('alt', row.showName || row.name || '教师示例照片'); img.style.objectFit = 'cover'
      img.setAttribute('width', '120'); img.setAttribute('height', '150'); filled++
      const li = img.closest('li')
      if (li) { li.setAttribute('data-boda-teacher', ''); li.closest('ul')?.setAttribute('data-boda-teachers', '') }
    } else if (!src || /^(?:\/system\/|#)|^(?!https?:|data:|blob:|\/\/)/i.test(src)) {
      if (/prev|next|previous/i.test((src || '') + img.id)) {
        const next = /next/i.test((src || '') + img.id)
        img.setAttribute('src', svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="28"><rect width="32" height="28" rx="4" fill="#e8efe5"/><path d="${next ? 'M12 8l6 6-6 6' : 'M19 8l-6 6 6 6'}" stroke="#5c7e53" stroke-width="2" fill="none"/></svg>`))
      } else img.setAttribute('src', placeholderImage)
      img.setAttribute('alt', img.alt || '原资源不可用，使用演示图片'); replaced++
    }
  }
  if (filled) notes.push(`已根据示例数据补全 ${filled} 张由博达脚本加载的教师图片，并提供基础列表排版`)
  if (replaced) notes.push(`${replaced} 张图片依赖原站资源或缺少地址，已使用演示图片替代`)
  let imageButtons = 0
  for (const input of doc.querySelectorAll('input[type="image"]')) {
    if (!/^(https?:|data:|blob:)/i.test(input.getAttribute('src') || '')) {
      const src = input.getAttribute('src') || ''; input.type = 'button'; input.value = input.value || input.alt || (/exit|logout/.test(src) ? '退出' : /login/.test(src) ? '登录' : /search|seach|cx/.test(src) ? '搜索' : /anniu_tp/.test(src) ? '投票' : '提交'); input.removeAttribute('src'); imageButtons++
    }
  }
  if (imageButtons) notes.push(`已将 ${imageButtons} 个依赖博达图片资源的按钮显示为文字按钮`)
  if (options.componentId === '004') { const counter = doc.getElementById(data.visittimename); if (counter) { counter.textContent = String(data._previewVisitCount ?? 1286); notes.push('访问计数使用 _previewVisitCount 演示数值，未连接统计接口') } }
  const uid = data.uid || ''
  const qrHost = doc.getElementById('output' + uid)
  if (options.componentId === '008' && qrHost) {
    try {
      const qr = qrcode(0, 'M'); qr.addData(String(data.text || 'https://example.invalid/')); qr.make()
      const image = doc.createElement('img'); image.src = qr.createDataURL(5, 10); image.alt = '示例数据生成的二维码'; image.width = Number(data.width) || 180; image.height = Number(data.height) || 180; qrHost.append(image)
      notes.push('二维码由浏览器根据示例 text 生成，未执行原模板脚本')
    } catch { notes.push('二维码内容过长或无效，请修改示例数据中的 text') }
  }
  const galleryHost = doc.getElementById('imgcontent' + uid)
  if (galleryHost && Array.isArray(data.pagepiclist) && data.pagepiclist.length) {
    const first = data.pagepiclist[0]; const img = doc.createElement('img'); img.src = first.pic || first.thumbpic || placeholderImage; img.alt = first.showTitle || '组图预览'; img.style.cssText = 'width:100%;max-height:380px;object-fit:contain'; galleryHost.append(img)
    const description = doc.getElementById('desccontent' + uid); if (description) description.textContent = first.showTitle || ''
    const counter = doc.getElementById('currenttotalsize' + uid); if (counter) counter.textContent = '1/' + data.pagepiclist.length
    const thumbs = doc.getElementById('thumbimgcontent' + uid)
    if (thumbs) for (const picture of data.pagepiclist) { const thumb = doc.createElement('img'); thumb.src = picture.thumbpic || picture.pic || placeholderImage; thumb.alt = picture.showTitle || '缩略图'; thumb.style.cssText = 'width:70px;height:50px;object-fit:cover;margin:4px'; thumbs.append(thumb) }
    notes.push('组图展示示例数据中的首图和缩略图，切换行为依赖博达运行环境')
  }
  const relatedHost = doc.getElementById('relateNews' + uid)
  if (relatedHost && options.componentId === '021') {
    relatedHost.textContent = ''
    const list = doc.createElement('div'); list.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px'
    for (const row of data._previewRelatedNews || []) { const item = doc.createElement('div'), img = doc.createElement('img'), label = doc.createElement('p'); img.src = row.picUrl || placeholderImage; img.alt = row.showTitle || '相关组图'; img.style.cssText = 'width:100%;height:100px;object-fit:cover'; label.textContent = row.showTitle; label.style.cssText = 'font-size:12px;line-height:1.8'; item.append(img, label); list.append(item) }
    relatedHost.append(list); notes.push('相关组图使用 _previewRelatedNews 演示数据填充，未访问博达接口')
  }
  const teacherLists = rows.filter(r => Array.isArray(r.teacherlist)).flatMap(r => r.teacherlist)
  const total = teacherLists.length || (Array.isArray(data.teacherlist) ? data.teacherlist.length : 0)
  const bars = { pageBarPageNumberId: total || 5, pageBarTotalNumberId: total || 5, pageBarCurPageId: 1, pageBarTotalPageId: 1 }
  let pagination = false
  for (const [key, value] of Object.entries(bars)) { const el = doc.getElementById(data[key]); if (el) { el.textContent = String(value); pagination = true } }
  if (pagination) notes.push('已填充教师列表的模拟分页计数')
  return notes
}
export const adapterCss = `ul[data-boda-teachers],ul.teacher-demo{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px;list-style:none;padding:0;margin:0}li[data-boda-teacher],ul.teacher-demo>li{text-align:center;border:1px solid #e7ece2;border-radius:5px;padding:14px;min-width:0}li[data-boda-teacher] table{margin:auto}li[data-boda-teacher] h2,ul.teacher-demo h3{font-size:17px;margin:8px 0}li[data-boda-teacher] p{font-size:12px;color:#798c70;margin:5px 0}input[type=button],input[type=submit]{border:1px solid #bdceb4;background:#f3f7ee;border-radius:4px;padding:4px 10px;color:#587548}`
