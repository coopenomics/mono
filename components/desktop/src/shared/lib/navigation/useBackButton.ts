import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDesktopStore } from 'src/entities/Desktop/model'
import type { IBackNavigationButton } from 'src/entities/Desktop/model/types'

interface BackButtonOptions {
  text: string
  routeName?: string
  params?: Record<string, string>
  componentId: string
  onClick?: () => void
}

/**
 * Хук для работы с кнопкой навигации "назад"
 *
 * @param options - объект с настройками кнопки
 * @returns Функции для управления кнопкой
 */
export function useBackButton(options: BackButtonOptions) {
  const router = useRouter()
  const desktopStore = useDesktopStore()

  // Устанавливаем кнопку навигации назад
  function setBackButton() {
    // Формируем данные для кнопки
    const button: IBackNavigationButton = {
      text: options.text,
      componentId: options.componentId,
      onClick: options.onClick || (() => {
        // Явно заданный родитель важнее истории; иначе — назад по истории
        if (options.routeName) {
          router.push({
            name: options.routeName,
            params: options.params || {}
          })
        } else {
          router.back()
        }
      })
    }

    desktopStore.setBackNavigationButton(button)
  }

  // Удаляем кнопку навигации назад
  function removeBackButton() {
    desktopStore.removeBackNavigationButton(options.componentId)
  }

  // Автоматически устанавливаем и удаляем кнопку
  onMounted(() => {
    setBackButton()
  })

  onUnmounted(() => {
    removeBackButton()
  })

  return {
    setBackButton,
    removeBackButton
  }
}
