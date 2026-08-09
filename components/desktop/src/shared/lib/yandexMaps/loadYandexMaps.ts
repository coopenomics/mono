/**
 * Динамический загрузчик Yandex Maps JS API.
 *
 * Идемпотентен: повторный вызов возвращает закэшированный `Promise<typeof ymaps>`.
 * Если `apiKey` пуст — возвращает Promise.reject; компонент-потребитель должен
 * показать деградированный UI (без карты).
 *
 * Единая точка загрузки SDK для всех карт desktop (виджет списка ПВЗ,
 * single-point карта в диалогах и т.д.) — поэтому живёт в shared/lib.
 */
let cached: Promise<unknown> | null = null

declare global {
  interface Window {
    ymaps?: any
  }
}

export function loadYandexMaps(apiKey: string): Promise<any> {
  if (!apiKey) return Promise.reject(new Error('YANDEX_MAPS_API_KEY не задан'))
  if (cached) return cached

  cached = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Yandex Maps доступен только в браузере'))
      return
    }
    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps))
      return
    }

    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => resolve(window.ymaps))
      } else {
        reject(new Error('Yandex Maps SDK загружен, но window.ymaps пуст'))
      }
    }
    script.onerror = () => reject(new Error('Не удалось загрузить Yandex Maps SDK'))
    document.head.appendChild(script)
  })

  return cached
}
