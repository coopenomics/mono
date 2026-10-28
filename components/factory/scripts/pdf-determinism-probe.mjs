#!/usr/bin/env node
/**
 * Проба детерминизма PDF между процессами WeasyPrint (шаг 0 фабрики v2).
 *
 * Один и тот же HTML рендерится дважды в каждом из двух свежих процессов
 * Python тем же циклом, что у воркера фабрики. Сравниваются четыре файла:
 * внутри процесса и между процессами. При расхождении печатается смещение
 * первого отличия и текст PDF вокруг него (объекты PDF почти целиком
 * текстовые), чтобы увидеть, какой объект зависит от процесса.
 *
 * Запуск: node scripts/pdf-determinism-probe.mjs <файл.html> [--no-seed]
 *   --no-seed — не задавать PYTHONHASHSEED (как было до 28.10.2026).
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'

const [htmlFile] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const noSeed = process.argv.includes('--no-seed')
if (!htmlFile) {
  console.error('Укажите HTML-файл')
  process.exit(2)
}

const PY = `
import sys
from weasyprint import HTML
sys.stdout.write("READY\\n"); sys.stdout.flush()
for line in sys.stdin:
    line = line.rstrip("\\n")
    if not line:
        continue
    in_path, out_path = line.split("\\t")
    HTML(filename=in_path).write_pdf(out_path)
    sys.stdout.write("OK\\n"); sys.stdout.flush()
`

const pythonBin = process.env.WEASY_PYTHON || '/venv/bin/python3'
const dir = mkdtempSync(join(tmpdir(), 'pdf-probe-'))
const html = readFileSync(htmlFile, 'utf8')
const inPath = join(dir, 'doc.html')
writeFileSync(inPath, html)

function startWorker(name) {
  const env = { ...process.env, SOURCE_DATE_EPOCH: '0', PYTHONUNBUFFERED: '1' }
  if (!noSeed)
    env.PYTHONHASHSEED = '0'
  const proc = spawn(pythonBin, ['-u', '-c', PY], { env })
  const rl = createInterface({ input: proc.stdout })
  const lines = []
  const waiters = []
  rl.on('line', (l) => {
    const w = waiters.shift()
    if (w)
      w(l)
    else lines.push(l)
  })
  proc.stderr.on('data', d => process.stderr.write(`[${name}] ${d}`))
  const next = () => new Promise((resolve) => {
    const l = lines.shift()
    if (l !== undefined)
      resolve(l)
    else waiters.push(resolve)
  })
  return {
    async ready() {
      const l = await next()
      if (l !== 'READY')
        throw new Error(`${name}: ожидался READY, получено ${l}`)
    },
    async render(outPath) {
      proc.stdin.write(`${inPath}\t${outPath}\n`)
      const l = await next()
      if (l !== 'OK')
        throw new Error(`${name}: ${l}`)
      return readFileSync(outPath)
    },
    stop() {
      proc.stdin.end()
      proc.kill()
    },
  }
}

const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16)

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i])
      return i
  }
  return a.length === b.length ? -1 : n
}

function context(buf, at, span = 160) {
  const from = Math.max(0, at - span)
  const to = Math.min(buf.length, at + span)
  return buf.subarray(from, to).toString('latin1').replace(/[^\x20-\x7E\n]/g, '.')
}

const A = startWorker('A')
const B = startWorker('B')
await A.ready()
await B.ready()
const a1 = await A.render(join(dir, 'a1.pdf'))
const a2 = await A.render(join(dir, 'a2.pdf'))
const b1 = await B.render(join(dir, 'b1.pdf'))
const b2 = await B.render(join(dir, 'b2.pdf'))
A.stop()
B.stop()

console.log(`PYTHONHASHSEED=${noSeed ? '(не задан)' : '0'}; размеры: a1=${a1.length} a2=${a2.length} b1=${b1.length} b2=${b2.length}`)
console.log(`хэши: a1=${sha(a1)} a2=${sha(a2)} b1=${sha(b1)} b2=${sha(b2)}`)

const pairs = [['a1', 'a2', a1, a2], ['b1', 'b2', b1, b2], ['a1', 'b1', a1, b1], ['a2', 'b2', a2, b2]]
let differs = false
for (const [x, y, bx, by] of pairs) {
  const at = firstDiff(bx, by)
  if (at < 0) {
    console.log(`${x} == ${y}`)
    continue
  }
  differs = true
  console.log(`${x} != ${y}: первое отличие на смещении ${at} из ${bx.length}/${by.length}`)
  console.log(`--- ${x} около ${at}:\n${context(bx, at)}\n--- ${y} около ${at}:\n${context(by, at)}`)
}
process.exit(differs ? 1 : 0)
