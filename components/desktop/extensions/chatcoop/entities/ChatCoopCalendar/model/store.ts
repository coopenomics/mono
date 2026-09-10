import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { api } from '../api'
import { useCalendarBoardPermissions } from '../../../shared/lib/useCalendarBoardPermissions'
import type { IChatCoopCalendarEvent, IChatCoopCalendarRoomOption } from './types'

const namespace = 'chatCoopCalendarStore'

interface IChatCoopCalendarStore {
  rooms: Ref<IChatCoopCalendarRoomOption[]>
  events: Ref<IChatCoopCalendarEvent[]>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  loadAll: () => Promise<void>
  clearError: () => void
}

export const useChatCoopCalendarStore = defineStore(
  namespace,
  (): IChatCoopCalendarStore => {
    const rooms = ref<IChatCoopCalendarRoomOption[]>([])
    const events = ref<IChatCoopCalendarEvent[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const { canManageCalendarEvents } = useCalendarBoardPermissions()

    const loadAll = async (): Promise<void> => {
      isLoading.value = true
      error.value = null
      try {
        // Комнаты нужны только диалогу создания события, а он открыт лишь совету —
        // сервер отдаёт их тоже только совету. Раньше их просил и рядовой пайщик:
        // сервер отказывал, и вместе с комнатами в Promise.all падали события —
        // пайщик видел «Не удалось загрузить календарь» вместо расписания.
        const [roomRows, eventRows] = await Promise.all([
          canManageCalendarEvents.value ? api.listRooms() : Promise.resolve([]),
          api.listEvents(),
        ])
        rooms.value = roomRows
        events.value = eventRows
      } catch (err: unknown) {
        console.error('ChatCoop calendar load failed:', err)
        error.value = 'Не удалось загрузить календарь.'
      } finally {
        isLoading.value = false
      }
    }

    const clearError = (): void => {
      error.value = null
    }

    return {
      rooms,
      events,
      isLoading,
      error,
      loadAll,
      clearError,
    }
  },
)
