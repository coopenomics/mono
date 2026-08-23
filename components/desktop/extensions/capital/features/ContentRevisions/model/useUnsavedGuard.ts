import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const LEAVE_MESSAGE = 'Есть несохранённые изменения. Уйти без сохранения?'

/**
 * Предупреждает об уходе со страницы с несохранёнными правками:
 * закрытие вкладки — через beforeunload, переход по роутеру — через confirm.
 */
export function useUnsavedGuard(hasChanges: Ref<boolean>) {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!hasChanges.value) return
    e.preventDefault()
    e.returnValue = LEAVE_MESSAGE
  }
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  onBeforeRouteLeave(() => {
    if (!hasChanges.value) return true
    return window.confirm(LEAVE_MESSAGE)
  })
}
