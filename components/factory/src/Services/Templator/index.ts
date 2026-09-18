import nunjucks from 'nunjucks'
import type { ITranslations, NestedRecord } from '../../Interfaces'

export interface ITemplateEngine {
  renderTemplate: (template: string, vars: unknown, translation: Record<string, string>) => string
}

class TransExtension {
  tags = ['trans']
  private readonly translation: ITranslations

  constructor(translation: ITranslations) {
    this.translation = translation
  }

  parse(parser: any, nodes: any) {
    const tok = parser.nextToken()
    const args = parser.parseSignature(null, true)
    parser.advanceAfterBlockEnd(tok.value)
    return new nodes.CallExtension(this, 'run', args)
  }

  run(_context: any, key: string, ...args: string[]): string | NestedRecord {
    let translation = this.translation[key] || key
    args.forEach((value, index) => {
      translation = translation.replace(new RegExp(`\\{${index}\\}`, 'g'), value)
    })

    return new nunjucks.runtime.SafeString(translation as unknown as string)
  }
}

export class TemplateEngine implements ITemplateEngine {
  protected readonly env: nunjucks.Environment

  constructor(translation: ITranslations) {
    // Включаем явный режим без автоэкранирования, чтобы HTML из данных рендерился как разметка
    this.env = new nunjucks.Environment(undefined, { autoescape: false })
    const transExtension = new TransExtension(translation)
    this.env.addExtension('TransExtension', transExtension)
  }

  // Декодируем HTML-сущности, если до фабрики дошёл экранированный текст (например, &lt;div&gt;)
  private decodeHtml(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
  }

  protected prepareVars(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.decodeHtml(value)
    }
    if (Array.isArray(value)) {
      return value.map(v => this.prepareVars(v))
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = this.prepareVars(v)
      }
      return result
    }
    return value
  }

  renderTemplate(template: string, vars: any): string {
    const prepared = this.prepareVars(vars)
    const context = prepared && typeof prepared === 'object' ? (prepared as object) : {}
    return this.env.renderString(template, context)
  }
}

/** Прочерк под рукописное заполнение — так в бланке выглядит любое поле, данных для которого у совета нет. */
export const BLANK_PLACEHOLDER = '______'

const BLANK_PRIMITIVE_KEYS = new Set<string | symbol>(['toString', 'valueOf', 'toJSON', Symbol.toPrimitive])

/**
 * Значение-заглушка бланка: в тексте печатается прочерком, вложенное поле
 * даёт такую же заглушку, перебор по нему пуст. Так один и тот же шаблон
 * собирается и с данными события, и без них — совет утверждает форму, а не
 * заполненный экземпляр.
 */
function blankValue(): unknown {
  const target: Record<string | symbol, unknown> = {}
  const proxy: unknown = new Proxy(target, {
    get(_t, key) {
      if (BLANK_PRIMITIVE_KEYS.has(key))
        return () => BLANK_PLACEHOLDER
      if (key === 'length')
        return 0
      // Не обещание, не итератор, не «объект с прототипом»: движок и Node
      // проверяют эти ключи и не должны принять заглушку за них.
      if (key === 'then' || key === Symbol.iterator || key === 'constructor' || key === 'prototype' || key === '__proto__')
        return undefined
      return proxy
    },
    has: () => false,
    ownKeys: () => [],
    getOwnPropertyDescriptor: () => undefined,
  })
  return proxy
}

/**
 * Оборачивает данные так, что любое отсутствующее поле на любой глубине
 * печатается прочерком. Известные значения остаются как есть.
 */
function blankify(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(blankify)
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    return new Proxy(source, {
      get(target, key) {
        if (typeof key === 'symbol' || key in target)
          return blankify(Reflect.get(target, key))
        return blankValue()
      },
    })
  }
  return value
}

/**
 * Собирает бланк: те же шаблон и переводы, что у документа на подпись, но
 * поля, для которых нет данных, печатаются прочерком. `knownKeys` — верхний
 * уровень модели шаблона: движок копирует контекст по ключам, поэтому имена,
 * которых нет во входе, объявляются здесь заглушками.
 */
export class BlankTemplateEngine extends TemplateEngine {
  renderBlank(template: string, vars: Record<string, unknown>, knownKeys: string[]): string {
    // Подготовка (раскодирование HTML) идёт до заглушек: она копирует объекты
    // по ключам и стёрла бы прокси. Контекст движку отдаём уже обёрнутым.
    const prepared = blankify(this.prepareVars(vars)) as Record<string, unknown>
    const context: Record<string, unknown> = {}
    for (const key of knownKeys)
      context[key] = blankValue()
    for (const key of Object.keys(vars))
      context[key] = prepared[key]
    return this.env.renderString(template, context)
  }
}
