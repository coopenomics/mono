import { defineStore } from 'pinia'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { api } from '../api'
import type { IAgenda, IGetAgendaInput } from './types';

const namespace = 'agendaStore';

interface IAgendaStore {
  agenda: ComputedRef<IAgenda[]>
  loading: Ref<boolean>
  loadAgenda: (data: IGetAgendaInput, hidden?: boolean) => Promise<IAgenda[]>;
  insertCreated: (item: IAgenda) => void;
}

export const useAgendaStore = defineStore(namespace, (): IAgendaStore => {
  // Authoritative-список из getAgenda (поллинг).
  const loadedAgenda = ref<IAgenda[]>([])
  const loading = ref(false)
  // Оптимистично вставленные вопросы, которых ещё нет в loadedAgenda: бэкенд
  // вернул созданный вопрос сразу после публикации (с settle-паузой), но
  // getAgenda-поллинг его ещё не отдаёт — лаг индексации блокчейна парсером.
  // Держим в буфере до подтверждения, чтобы вопрос не «мигал» (появился из
  // publish → исчез на ближайшем поллинге → снова появился).
  const createdBuffer = ref<IAgenda[]>([])

  const idOf = (item: IAgenda): string => String(item?.table?.id ?? '')

  // Итоговая повестка: ещё не подтверждённые из буфера (сверху) + authoritative.
  const agenda = computed<IAgenda[]>(() => {
    if (!createdBuffer.value.length) return loadedAgenda.value
    const loadedIds = new Set(loadedAgenda.value.map(idOf))
    const pending = createdBuffer.value.filter((item) => !loadedIds.has(idOf(item)))
    return [...pending, ...loadedAgenda.value]
  })

  const loadAgenda = async (data: IGetAgendaInput, hidden = false): Promise<IAgenda[]> => {
    try {
      loading.value = hidden ? false : true
      const loadedData = await api.loadAgenda(data);
      loadedAgenda.value = loadedData;
      // Подтверждённые вопросы убираем из буфера: authoritative-данные пришли.
      if (createdBuffer.value.length) {
        const loadedIds = new Set(loadedData.map(idOf))
        createdBuffer.value = createdBuffer.value.filter((item) => !loadedIds.has(idOf(item)))
      }
      loading.value = false
      return loadedData;
    } catch (error) {
      loading.value = false
      throw error;
    }
  };

  // Оптимистично добавляет только что созданный вопрос (из ответа publish).
  const insertCreated = (item: IAgenda): void => {
    if (!item?.table?.id) return
    const id = idOf(item)
    if (createdBuffer.value.some((existing) => idOf(existing) === id)) return
    if (loadedAgenda.value.some((existing) => idOf(existing) === id)) return
    createdBuffer.value = [item, ...createdBuffer.value]
  }

  return {
    agenda,
    loading,
    loadAgenda,
    insertCreated
  }
})
