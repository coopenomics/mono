/**
 * Построчный diff двух текстов в формате unified (+/-/пробел) для DiffViewer.
 * LCS по строкам; для текстов описаний (сотни строк) квадратичной памяти достаточно.
 */
export function unifiedLineDiff(before: string, after: string, context = 2): string {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  type Op = { kind: ' ' | '-' | '+'; text: string }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: '-', text: a[i] })
      i++
    } else {
      ops.push({ kind: '+', text: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ kind: '-', text: a[i++] })
  while (j < m) ops.push({ kind: '+', text: b[j++] })

  if (!ops.some((o) => o.kind !== ' ')) return ''

  // Оставляем только изменённые участки с контекстом
  const keep = new Array<boolean>(ops.length).fill(false)
  ops.forEach((o, idx) => {
    if (o.kind === ' ') return
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true
  })
  const out: string[] = []
  let inHunk = false
  ops.forEach((o, idx) => {
    if (!keep[idx]) {
      inHunk = false
      return
    }
    if (!inHunk) {
      out.push('@@')
      inHunk = true
    }
    out.push(`${o.kind}${o.text}`)
  })
  return out.join('\n')
}
