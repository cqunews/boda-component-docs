// Remove external source links while retaining template and browser API syntax.
export function sanitizeTemplate(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, comment => /https?:\/\//i.test(comment) ? '' : comment)
    .replace(/https?:\/\/[^\s"'<>\)]+/g, url => /^https?:\/\/www\.w3\.org\//.test(url) ? url : 'https://example.invalid/')
}
