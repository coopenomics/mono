/* eslint-disable unused-imports/no-unused-vars */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import os from 'node:os'
import { type ChildProcessWithoutNullStreams, execSync, spawn } from 'node:child_process'
import readline from 'node:readline'
import { PDFDocument } from 'pdf-lib'
import moment from 'moment-timezone'
import { v4 as uuidv4 } from 'uuid'
import type { IGeneratedDocument, IMetaDocument, ITranslations } from '../../Interfaces'
import { TemplateEngine } from '../Templator'
import { calculateSha256 } from '../../Utils/calculateSHA'

const weasyPrintVersion = '67' // ВАЖНО: держать в синхроне с controller/Dockerfile (pip install WeasyPrint==X) и мета-данными каждого документа

// ─── Тёплый пул процессов WeasyPrint ──────────────────────────────────────
// WeasyPrint медленный не на рендере, а на холодном старте: запуск Python +
// import всего стека (cffi/pydyf/tinycss2/Pango/cairo/HarfBuzz) + скан
// fontconfig занимает 3-5 сек. Раньше это платилось на КАЖДЫЙ документ через
// `exec weasyprint ...` (процесс умирал сразу). Здесь держим N долгоживущих
// Python-процессов горячими: import платится один раз за жизнь бэкенда, далее
// каждый документ = чистый рендер (<0.5 сек). Пул даёт реальный параллелизм
// (=WEASY_POOL_SIZE): одновременные генерации не сериализуются в очередь к
// одному процессу. Воркер живёт внутри процесса controller'а — без докера,
// миграций и отдельного сервиса. Детерминизм сохраняется: SOURCE_DATE_EPOCH=0
// в env воркера (наследуется на все рендеры, убивает встроенный timestamp).
//
// Протокол: в stdin воркера пишем "<htmlPath>\t<pdfPath>\n", читаем из stdout
// строку "OK" (успех) или "ERR <traceback>" (ошибка). Бинарь PDF не гоним
// через пайп — обмениваемся путями к временным файлам (надёжно, без фрейминга).
const PY_WORKER_LOOP = `
import sys, traceback
from weasyprint import HTML
sys.stdout.write("READY\\n"); sys.stdout.flush()
for line in sys.stdin:
    line = line.rstrip("\\n")
    if not line:
        continue
    try:
        in_path, out_path = line.split("\\t")
        HTML(filename=in_path).write_pdf(out_path)
        sys.stdout.write("OK\\n")
    except Exception:
        sys.stdout.write("ERR " + traceback.format_exc().replace("\\n", " | ") + "\\n")
    sys.stdout.flush()
`

class WeasyWorker {
  private proc: ChildProcessWithoutNullStreams | null = null
  private rl: readline.Interface | null = null
  private pending: { resolve: () => void, reject: (e: Error) => void } | null = null
  private ready = false
  private readyWaiters: Array<() => void> = []
  private stderr = ''

  private static resolvedPythonBin: string | null = null

  private static pythonBin(): string {
    if (WeasyWorker.resolvedPythonBin)
      return WeasyWorker.resolvedPythonBin

    const fromEnv = process.env.WEASY_PYTHON
    if (fromEnv && fs.existsSync(fromEnv)) {
      WeasyWorker.resolvedPythonBin = fromEnv
      return fromEnv
    }

    // Docker controller: WeasyPrint в /venv (см. controller/Dockerfile).
    for (const candidate of ['/venv/bin/python3', '/opt/weasyprint-venv/bin/python3']) {
      if (fs.existsSync(candidate)) {
        WeasyWorker.resolvedPythonBin = candidate
        return candidate
      }
    }

    // Локально `python3` часто не тот интерпретатор, куда установлен weasyprint CLI.
    // Берём shebang из `weasyprint` в PATH (AGENTS.md: /opt/weasyprint-venv или brew/pip).
    const fromCli = WeasyWorker.pythonFromWeasyprintShebang()
    if (fromCli) {
      WeasyWorker.resolvedPythonBin = fromCli
      return fromCli
    }

    WeasyWorker.resolvedPythonBin = 'python3'
    return 'python3'
  }

  private static pythonFromWeasyprintShebang(): string | null {
    try {
      const weasyPath = execSync('command -v weasyprint', { encoding: 'utf8' }).trim()
      if (!weasyPath)
        return null

      const firstLine = fs.readFileSync(weasyPath, { encoding: 'utf8' }).split('\n', 1)[0] ?? ''
      const match = firstLine.match(/^#!(\S+)/)
      if (match?.[1] && fs.existsSync(match[1]))
        return match[1]

      const dir = path.dirname(weasyPath)
      for (const name of ['python3', 'python']) {
        const candidate = path.join(dir, name)
        if (fs.existsSync(candidate))
          return candidate
      }
    }
    catch {
      // weasyprint не в PATH — упадём на python3 с понятной ошибкой в stderr воркера
    }

    return null
  }

  private ensure(): void {
    if (this.proc && !this.proc.killed)
      return

    this.ready = false
    this.stderr = ''

    const proc = spawn(WeasyWorker.pythonBin(), ['-u', '-c', PY_WORKER_LOOP], {
      env: { ...process.env, SOURCE_DATE_EPOCH: '0', PYTHONUNBUFFERED: '1' },
    })
    this.proc = proc
    this.rl = readline.createInterface({ input: proc.stdout })

    proc.stderr.on('data', (chunk: Buffer | string) => {
      this.stderr += chunk.toString()
    })

    this.rl.on('line', (line) => {
      if (line === 'READY') {
        this.ready = true
        for (const wake of this.readyWaiters.splice(0))
          wake()
        return
      }
      const p = this.pending
      this.pending = null
      if (!p)
        return
      if (line === 'OK')
        p.resolve()
      else
        p.reject(new Error(`WeasyPrint: ${line}`))
    })

    const die = (e?: Error) => {
      this.proc = null
      this.rl?.close()
      this.rl = null
      this.ready = false
      for (const wake of this.readyWaiters.splice(0))
        wake()

      const p = this.pending
      this.pending = null
      const stderr = this.stderr.trim()
      const reason = stderr || e?.message || 'WeasyPrint worker exited'
      p?.reject(new Error(reason))
    }
    proc.on('exit', () => die())
    proc.on('error', die)
  }

  private whenReady(): Promise<void> {
    if (this.ready)
      return Promise.resolve()
    return new Promise(resolve => this.readyWaiters.push(resolve))
  }

  async render(htmlPath: string, pdfPath: string): Promise<void> {
    this.ensure()
    await this.whenReady()
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject }
      this.proc!.stdin.write(`${htmlPath}\t${pdfPath}\n`)
    })
  }
}

class WeasyPool {
  private static size = Math.max(
    1,
    Number.parseInt(process.env.WEASY_POOL_SIZE || '', 10) || Math.min(4, os.cpus().length),
  )

  private static free: WeasyWorker[] = []
  private static waiters: Array<(w: WeasyWorker) => void> = []
  private static inited = false

  private static init(): void {
    if (this.inited)
      return
    for (let i = 0; i < this.size; i++)
      this.free.push(new WeasyWorker())
    this.inited = true
  }

  private static acquire(): Promise<WeasyWorker> {
    this.init()
    const w = this.free.pop()
    if (w)
      return Promise.resolve(w)
    return new Promise(resolve => this.waiters.push(resolve))
  }

  private static release(w: WeasyWorker): void {
    const next = this.waiters.shift()
    if (next)
      next(w)
    else
      this.free.push(w)
  }

  static async render(htmlPath: string, pdfPath: string): Promise<void> {
    const w = await this.acquire()
    try {
      await w.render(htmlPath, pdfPath)
    }
    finally {
      this.release(w)
    }
  }
}

export interface IPDFService {
  generateDocument: (
    template: string,
    combinedVars: any,
    translation: ITranslations,
    meta: IMetaDocument,
  ) => Promise<IGeneratedDocument>
}

export class PDFService implements IPDFService {
  public async generateDocument(
    template: string,
    combinedVars: any,
    translation: ITranslations,
    meta: IMetaDocument,
  ): Promise<IGeneratedDocument> {
    // Создаем экземпляр TemplateEngine и генерируем HTML

    const templateEngine = new TemplateEngine(translation)
    const html = templateEngine.renderTemplate(template, combinedVars)

    // Генерируем PDF буфер из HTML
    const buffer = await PDFService.generatePDFBuffer(html)

    // Обновляем метаданные
    const binary: Uint8Array = await PDFService.updateMetadata(buffer, meta)

    // Вычисляем SHA-256 хэш буфера
    const hash = calculateSha256(binary)

    return { full_title: '', html, hash, binary, meta }
  }

  private static async generatePDFBuffer(htmlContent: string): Promise<Uint8Array> {
    const tempId = uuidv4() // Генерируем уникальный ID для временных файлов
    // Используем системный tmpdir вместо __dirname/tmp: dist/ при докер-сборке
    // монтируется read-only, и попытка mkdir внутри bundle падает EROFS.
    const tempDir = path.join(os.tmpdir(), 'factory-pdf')

    // Создаем папку tmp, если её нет (с обработкой race condition)
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
    }
    catch (dirError) {
      // Папка может быть создана другим процессом, игнорируем ошибку
    }

    const tempHtmlPath = path.join(tempDir, `${tempId}.html`)
    const tempPdfPath = path.join(tempDir, `${tempId}.pdf`)

    // CSS с указанием кодировки и шрифта.
    // Arial установлен СИСТЕМНО в образе (controller/Dockerfile → fontconfig),
    // поэтому НЕ встраиваем шрифт через data:base64 — иначе weasyprint парсил бы
    // ~270 КБ TTF на КАЖДЫЙ рендер (≈1.3 сек). Системный шрифт парсится один раз
    // и кешируется fontconfig'ом. Тот же файл шрифта — глифы/вёрстка идентичны.
    const fontStyle = `
      <style>
        * {
          font-family: 'Arial', sans-serif;
        }
      </style>
      <meta charset="UTF-8">
    `

    // Объединяем CSS и HTML-контент
    const htmlWithFontStyle = fontStyle + htmlContent

    // Сохраняем HTML-контент во временный файл
    fs.writeFileSync(tempHtmlPath, htmlWithFontStyle, { encoding: 'utf8' })

    // Рендерим через тёплый пул WeasyPrint (без spawn'а процесса на каждый док)
    try {
      await WeasyPool.render(tempHtmlPath, tempPdfPath)
      const pdfBuffer = fs.readFileSync(tempPdfPath)
      return new Uint8Array(pdfBuffer)
    }
    finally {
      // Удаляем временные файлы в любом случае (успех или ошибка)
      try {
        if (fs.existsSync(tempHtmlPath))
          fs.unlinkSync(tempHtmlPath)
      }
      catch (_cleanupError) {
        // Игнорируем ошибки очистки, так как это не критично
      }
      try {
        if (fs.existsSync(tempPdfPath))
          fs.unlinkSync(tempPdfPath)
      }
      catch (_cleanupError) {
        // Игнорируем ошибки очистки, так как это не критично
      }
    }
  }

  private static async updateMetadata(pdfBuffer: Uint8Array, meta: IMetaDocument): Promise<Uint8Array> {
    const dateWithTimezone = moment.tz(meta.created_at, 'DD.MM.YYYY HH:mm', meta.timezone).toDate()

    const pdfDoc = await PDFDocument.load(pdfBuffer)
    pdfDoc.setTitle(meta.title)
    pdfDoc.setLanguage(meta.lang)
    pdfDoc.setSubject(`Шаблона документа по реестру №${meta.registry_id}`)
    pdfDoc.setCreator(`${meta.generator}-${meta.version}`)
    pdfDoc.setCreationDate(dateWithTimezone)
    pdfDoc.setModificationDate(dateWithTimezone)
    pdfDoc.setProducer(`weasyprint-v${weasyPrintVersion}`)

    return pdfDoc.save({ useObjectStreams: false })
  }
}
