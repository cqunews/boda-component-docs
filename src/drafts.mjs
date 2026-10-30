export function fingerprint(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(16)
}
export function fixtureFingerprint(json) { try { return fingerprint(JSON.stringify(JSON.parse(json))) } catch { return '' } }
export function migrateDraft(draft, baseline, previousFixtureHashes = []) {
  if (![1, 2].includes(draft?.version) || !['template', 'css', 'json'].every(k => typeof draft[k] === 'string')) return null
  const result = { template: draft.template, css: draft.css, json: draft.json, fixtureUpdated: false }
  if (draft.version === 2 && draft.baseline) {
    for (const key of ['template', 'css', 'json']) if (draft[key] === draft.baseline[key]) result[key] = baseline[key]
  }
  if (previousFixtureHashes.includes(fixtureFingerprint(draft.json))) result.json = baseline.json
  result.fixtureUpdated = result.json !== draft.json
  return result
}
