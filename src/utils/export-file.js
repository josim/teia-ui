// Small client-side export helpers (CSV / JSON / clipboard). No dependencies —
// the download trigger uses the standard Blob + object-URL + anchor click.

/** Serialize rows to CSV. `columns` is [{ key, header }] in output order. */
export function toCSV(rows, columns) {
  const esc = (v) => {
    if (v == null) return ''
    let s = String(v)
    // Neutralize spreadsheet formula injection: a cell beginning with = + - @
    // (or a leading tab/CR) is evaluated as a formula by Excel/Sheets. Prefix
    // with a single quote so it is rendered as literal text instead.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.map((c) => esc(c.header)).join(',')
  const body = rows
    .map((r) => columns.map((c) => esc(r[c.key])).join(','))
    .join('\n')
  return `${head}\n${body}`
}

/** Pick + order object keys per `columns`, for a clean JSON export. */
export function toJSON(rows, columns) {
  const picked = rows.map((r) =>
    Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? null]))
  )
  return JSON.stringify(picked, null, 2)
}

/** Trigger a browser download of `content` as `filename`. */
export function downloadFile(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Copy text to the clipboard; resolves false if the API is unavailable. */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
