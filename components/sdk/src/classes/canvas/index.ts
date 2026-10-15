import { lt } from '@coopenomics/i18n'
/**
 * Класс `Canvas` предоставляет инструмент для создания и управления HTML5 `<canvas>` с целью извлечения
 * собственноручной подписи пользователя. Основное предназначение класса — упрощение работы с холстом
 * для сбора подписи, её валидации и экспорта в формате base64.
 *
 * @remarks
 * - Автоматически создаёт элемент `<canvas>` внутри указанного контейнера и подстраивает его размеры.
 * - Обеспечивает корректную работу с мышью и тач-устройствами для рисования подписи.
 * - Включает утилиты для очистки холста и извлечения подписи.
 * - Сохраняет содержимое при изменении размеров контейнера.
 * - Отключает прокрутку при касаниях через `touchAction: none`.
 *
 * @example
 * Пример использования для извлечения подписи пайщика:
 * ```ts
 * import { Classes } from '@coopenomics/sdk'
 *
 * // Указываем контейнер, где будет размещён холст
 * const container = document.getElementById('signature-container') as HTMLElement
 *
 * // Создаём экземпляр Canvas для работы с подписью
 * const signatureCanvas = new Classes.Canvas(container, {
 *   lineWidth: 5,
 *   strokeStyle: '#000',
 * })
 *
 * // Очистка холста при необходимости
 * signatureCanvas.clearCanvas()
 *
 * // Извлечение подписи в формате base64
 * const signature = signatureCanvas.getSignature()
 * console.log('Подпись в формате base64:', signature)
 *
 * // Освобождение ресурсов, если холст больше не нужен
 * signatureCanvas.destroy()
 * ```
 *
 * @public
 */
export class Canvas {
  public canvas: HTMLCanvasElement
  public ctx: CanvasRenderingContext2D

  private drawing = false
  private lastX = 0
  private lastY = 0

  /**
   * Создаёт экземпляр класса `Canvas` и подготавливает холст для рисования подписи.
   *
   * @param container - HTML-элемент, внутри которого создаётся `<canvas>`.
   * @param opts - Настройки:
   *   - `lineWidth` - Толщина линии для рисования (по умолчанию 5).
   *   - `strokeStyle` - Цвет линии для рисования (по умолчанию чёрный, `#000`).
   */
  constructor(
    private container: HTMLElement,
    private opts: {
      lineWidth?: number
      strokeStyle?: string
    } = {},
  ) {
    // Создаём и добавляем <canvas> в контейнер
    this.canvas = document.createElement('canvas')
    this.canvas.width = container.offsetWidth
    this.canvas.height = container.offsetHeight

    // Отключаем скроллинг при касаниях
    this.canvas.style.touchAction = 'none'

    container.appendChild(this.canvas)

    // Инициализируем контекст рисования
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error(lt('sdkClient.error.canvasNotSupported'))
    }
    this.ctx = ctx

    // Устанавливаем параметры рисования
    this.ctx.lineWidth = this.opts.lineWidth ?? 5
    this.ctx.lineJoin = 'round'
    this.ctx.lineCap = 'round'
    this.ctx.strokeStyle = this.opts.strokeStyle ?? '#000'

    // Навешиваем обработчики событий для рисования
    this.initEvents()
  }

  /**
   * Очищает холст.
   */
  public clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Возвращает содержимое холста (подпись) в формате base64 (PNG).
   *
   * @returns Подпись в формате base64.
   */
  public getSignature(): string {
    return this.canvas.toDataURL('image/png')
  }

  /**
   * Снимает все обработчики событий и очищает ресурсы.
   */
  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)

    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
  }

  // Внутренние методы

  /**
   * Навешивает обработчики событий мыши и тач-устройств.
   */
  private initEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('mouseup', this.onMouseUp)

    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false })
  }

  private onMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    this.drawing = true
    const rect = this.canvas.getBoundingClientRect()
    this.lastX = e.clientX - rect.left
    this.lastY = e.clientY - rect.top
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.drawing)
      return
    e.preventDefault()
    this.drawLine(e.clientX, e.clientY)
  }

  private onMouseUp = () => {
    this.drawing = false
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    this.drawing = true
    const rect = this.canvas.getBoundingClientRect()
    const t = e.touches[0]
    this.lastX = t.clientX - rect.left
    this.lastY = t.clientY - rect.top
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.drawing)
      return
    e.preventDefault()
    const t = e.touches[0]
    this.drawLine(t.clientX, t.clientY)
  }

  private onTouchEnd = () => {
    this.drawing = false
  }

  private drawLine(clientX: number, clientY: number) {
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastX, this.lastY)

    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    this.ctx.lineTo(x, y)
    this.ctx.stroke()

    this.lastX = x
    this.lastY = y
  }
}
