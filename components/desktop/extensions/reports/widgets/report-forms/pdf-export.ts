/**
 * Экспорт DOM-узла `.printable-form` в PDF-файл с разбивкой по `<section class="page">`
 * через CSS `page-break-after: always` (уже стоит в `@media print`).
 *
 * html2pdf.js = html2canvas (DOM → canvas) + jsPDF (canvas → PDF). Минусы:
 * текст становится растровым (не выделяется мышью), размер файла больше, чем
 * векторного PDF. Плюсы: 100% совпадение с визуалом на экране, русский текст
 * без шрифтовых заморочек (в jsPDF прямое добавление Times/Arial требует
 * embed'а шрифта — для нашего случая избыточно).
 *
 * На 2-4 листа формата A4 итоговый PDF ~300-600 KB — приемлемо.
 */
export async function exportFormToPdf(el: HTMLElement, fileName: string): Promise<void> {
  // html2pdf.js на верхнем уровне модуля обращается к `self` → при SSR-бандле
  // падает `ReferenceError: self is not defined` (Quasar boot error). Грузим
  // библиотеку лениво: экспорт вызывается только по действию пользователя в
  // браузере, на сервере модуль не вычисляется.
  const { default: html2pdf } = await import('html2pdf.js')

  // scale: 2 — рендер в 2× разрешении, тексту в растровом PDF нужна
  // высокая плотность чтобы читаться при печати. 3 заметно медленнее,
  // 1.5 уже мыльный.
  // Режим 'css' — листы разрываются по `page-break-*` CSS-правилам.
  // `avoid: 'tr'` гарантирует, что строка таблицы не режется пополам между
  // страницами PDF.
  // Упрощённые типы html2pdf.js не декларируют `pagebreak`, хотя фактически
  // движок его поддерживает. Приводим options к Record для обхода TS2353.
  const opt: Record<string, unknown> = {
    margin: 0,
    filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
  }
  await (html2pdf() as unknown as {
    set: (o: Record<string, unknown>) => {
      from: (el: HTMLElement) => { save: () => Promise<void> }
    }
  })
    .set(opt)
    .from(el)
    .save()
}

/**
 * Делает имя PDF-файла из данных сгенерированного отчёта. Формат:
 * `<reportType>-<year>[-<period>].pdf`, всё в нижнем регистре.
 */
export function makePdfFileName(reportType: string, year: number, period?: number | null): string {
  const base = `${reportType.toLowerCase()}-${year}`
  return period != null ? `${base}-q${period}.pdf` : `${base}.pdf`
}
