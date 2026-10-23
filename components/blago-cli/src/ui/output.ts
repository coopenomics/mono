import pc from 'picocolors'

/**
 * Текст пойманного значения для вывода человеку.
 *
 * SDK при отказе сервера бросает `GraphQLResponseError` — обычный `Error`, чей
 * `message` уже склеен из сообщений сервера. Ветки ниже для массива и голого
 * объекта оставлены: так бросали старые сборки SDK, и так могут бросать чужие
 * библиотеки; `String()` для них даёт «[object Object]».
 */
export function formatThrownValue(e: unknown): string {
  if (e instanceof Error) {
    return e.message
  }
  if (Array.isArray(e)) {
    return e.map(item => formatThrownValue(item)).filter(s => s.length > 0).join('\n')
  }
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>
    if (typeof o.message === 'string' && o.message.length > 0) {
      return o.message
    }
    try {
      return JSON.stringify(e)
    }
    catch {
      return String(e)
    }
  }
  return String(e)
}

export function info(message: string): void {
  console.log(pc.cyan(message))
}

export function success(message: string): void {
  console.log(pc.green(message))
}

export function warn(message: string): void {
  console.warn(pc.yellow(message))
}

export function error(message: string): void {
  console.error(pc.red(message))
}
