/* eslint-disable unused-imports/no-unused-vars */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exec } from 'node:child_process'
import { PDFDocument } from 'pdf-lib'
import moment from 'moment-timezone'
import { v4 as uuidv4 } from 'uuid'
import type { IGeneratedDocument, IMetaDocument, ITranslations } from '../../Interfaces'
import { TemplateEngine } from '../Templator'
import { calculateSha256 } from '../../Utils/calculateSHA'
import { ArialBase64 } from '../../Fonts/arial'

const weasyPrintVersion = '62.3' // фиксируем в Dockerfile и мета-данных каждого документа

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

    // CSS с указанием кодировки и шрифтом для кириллицы
    const fontStyle = `
      <style>
        @font-face {
          font-family: 'Arial';
          src: url(data:font/ttf;base64,${ArialBase64}) format('truetype');
        }
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

    return new Promise((resolve, reject) => {
      // Запускаем WeasyPrint для конвертации HTML в PDF
      exec(`SOURCE_DATE_EPOCH=0 weasyprint ${tempHtmlPath} ${tempPdfPath}`, (error) => {
        if (error) {
          // Удаляем временные файлы при ошибке
          try {
            if (fs.existsSync(tempHtmlPath)) {
              fs.unlinkSync(tempHtmlPath)
            }
          }
          catch (_cleanupError) {
            // Игнорируем ошибки очистки, так как это не критично
          }
          reject(error)
        }
        else {
          // Читаем PDF-файл и возвращаем его как Uint8Array
          const pdfBuffer = fs.readFileSync(tempPdfPath)
          // Удаляем временные файлы после завершения
          try {
            if (fs.existsSync(tempHtmlPath)) {
              fs.unlinkSync(tempHtmlPath)
            }
            if (fs.existsSync(tempPdfPath)) {
              fs.unlinkSync(tempPdfPath)
            }
          }
          catch (_cleanupError) {
            // Игнорируем ошибки очистки, так как это не критично
          }
          resolve(new Uint8Array(pdfBuffer))
        }
      })
    })
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
