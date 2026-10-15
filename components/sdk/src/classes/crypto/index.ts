import { lt } from '@coopenomics/i18n'
/**
 * Класс Crypto предоставляет универсальные методы для работы с криптографией.
 * В частности, реализован статический метод для получения sha256-хэша.
 */

export class Crypto {
  /**
   * Получить sha256-хэш от строки или числа (hex-строка).
   * Работает как в Node.js, так и в браузере (если доступен Web Crypto API).
   * @param data Данные для хэширования (строка или число)
   * @returns Хэш в виде hex-строки
   */
  static async sha256(data: string | number): Promise<string> {
    const str = String(data)

    // Проверяем наличие браузерного API
    const isBrowser = typeof window !== 'undefined'
      && typeof window.crypto !== 'undefined'
      && typeof window.crypto.subtle !== 'undefined'

    if (isBrowser) {
      // Используем браузерный Web Crypto API
      const encoder = new TextEncoder()
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(str))
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }
    else {
      // Динамический импорт: без top-level `node:crypto` клиентский бандлер (Vite/Rolldown) не тянет Node API
      try {
        const { createHash } = await import('node:crypto')
        return createHash('sha256').update(str).digest('hex')
      }
      catch (error) {
        console.warn('Node.js crypto модуль недоступен', error)
        throw new Error(lt('sdkClient.error.cryptoNotSupported'))
      }
    }
  }
}
