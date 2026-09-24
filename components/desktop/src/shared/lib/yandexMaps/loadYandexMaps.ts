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
  // i18n-ignore: Error, попадает только в catch вызывающих компонентов (Map.vue/KUMapWithList.vue), которые пишут его в console.warn и пользователю не показывают; ветка apiKey='' к тому же не достигается — вызывающие проверяют apiKey до вызова loadYandexMaps
  if (!apiKey) return Promise.reject(new Error('YANDEX_MAPS_API_KEY не задан'))
  if (cached) return cached

  cached = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      // i18n-ignore: Error, ловится в initMap() вызывающих компонентов только console.warn'ом, пользователю не показывается
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
        // i18n-ignore: Error, ловится в initMap() вызывающих компонентов только console.warn'ом, пользователю не показывается
        reject(new Error('Yandex Maps SDK загружен, но window.ymaps пуст'))
      }
    }
    // i18n-ignore: Error, ловится в initMap() вызывающих компонентов только console.warn'ом, пользователю не показывается
    script.onerror = () => reject(new Error('Не удалось загрузить Yandex Maps SDK'))
    document.head.appendChild(script)
  })

  return cached
}
