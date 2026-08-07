/**
 * Печать листа этикеток на A4: оператор печатает, режет и наклеивает.
 *
 * Печатается изолированный документ в скрытом iframe, а не текущий UI —
 * иначе в лист попадают шапка, меню и всё остальное приложение. Каркас общий
 * для двух листов, которые уже есть на столе ПВЗ: штрих-коды имущества и
 * QR-коды боксов. Отличается у них только содержимое одной этикетки.
 */

export interface PrintLabelSheetOptions {
  /** Заголовок документа печати (виден в диалоге принтера). */
  title: string
  /** Внутренняя разметка каждой этикетки — по одной строке на этикетку. */
  labels: string[]
  /** Сколько этикеток в ряду. По умолчанию три — размер под обычную наклейку. */
  columns?: number
}

/** Экранирование пользовательского текста, попадающего в лист печати. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printLabelSheet(options: PrintLabelSheetOptions): void {
  const { title, labels } = options
  if (!labels.length) return
  const columns = options.columns ?? 3

  const body = labels.map((inner) => `<div class="lbl">${inner}</div>`).join('')
  // Лист печатается на белой бумаге, поэтому здесь сознательно печатные цвета,
  // а не токены темы: документ живёт вне приложения и тему не наследует.
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 4mm; }
    .lbl { border: 1px solid #ddd; border-radius: 6px; padding: 6px; display: flex; flex-direction: column; align-items: center; break-inside: avoid; }
    .lbl svg, .lbl img { display: block; max-width: 100%; }
    .code { margin-top: 4px; letter-spacing: 2px; font-size: 13px; color: #111; }
    .note { margin-top: 2px; font-size: 11px; color: #555; text-align: center; overflow-wrap: anywhere; }
  </style></head><body><div class="grid">${body}</div></body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.srcdoc = html
  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) return
    win.focus()
    win.print()
    win.addEventListener('afterprint', () => iframe.remove())
    // Страховка: `afterprint` не приходит, если диалог печати закрыли иначе.
    window.setTimeout(() => iframe.remove(), 60000)
  }
  document.body.appendChild(iframe)
}
