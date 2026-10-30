import { renderTemplate, locate } from './index.mjs'
self.onmessage = ({ data: request }) => {
  const { id, template, css, data, strict } = request
  let styleStage = false
  try {
    const options = { strict, booleanFormat: 'c' }
    const result = renderTemplate(template, data, options)
    styleStage = true
    const styles = renderTemplate(css || '', data, options)
    self.postMessage({ id, ...result, css: styles.html, warnings: [...new Set([...result.warnings, ...styles.warnings])], stats: { operations: result.stats.operations + styles.stats.operations, milliseconds: result.stats.milliseconds + styles.stats.milliseconds } })
  } catch (e) {
    self.postMessage({ id, error: { message: e.message, css: styleStage, ...locate(styleStage ? css || '' : template, e.offset) } })
  }
}
