import { defineStore } from 'pinia'
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { api } from '../api'
import type { IAgenda, IGetAgendaInput } from './types';

const namespace = 'agendaStore';

const idOf = (item: IAgenda): string => String(item?.table?.id ?? '')

/** Вопросы из `items`, которых ещё нет в `loaded`. */
const notLoaded = (items: IAgenda[], loaded: IAgenda[]): IAgenda[] => {
  const loadedIds = new Set(loaded.map(idOf))
  return items.filter((item) => !loadedIds.has(idOf(item)))
}

interface IAgendaStore {
  agenda: ComputedRef<IAgenda[]>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  loadAgenda: (data: IGetAgendaInput, hidden?: boolean) => Promise<IAgenda[]>;
  refresh: (data: IGetAgendaInput) => Promise<void>;
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

  // Итоговая повестка: ещё не подтверждённые из буфера (сверху) + authoritative.
  const agenda = computed<IAgenda[]>(() => {
    if (!createdBuffer.value.length) return loadedAgenda.value
    return [...notLoaded(createdBuffer.value, loadedAgenda.value), ...loadedAgenda.value]
  })

  // Запросы повестки идут внахлёст (первая загрузка экрана, живое обновление,
  // кнопка «Обновить»). Ответ более раннего запроса, пришедший позже, затёр бы
  // свежий список старым — применяем только ответ новее последнего применённого.
  let requestSeq = 0
  let appliedSeq = 0

  const loadAgenda = async (data: IGetAgendaInput, hidden = false): Promise<IAgenda[]> => {
    const seq = ++requestSeq
    // Скрытое обновление (живая повестка, кнопка «Обновить») флаг загрузки не
    // трогает. Прежде оно сбрасывало его в начале и в конце — и гасило каркас
    // идущей первой загрузки: страница вопроса, открытая из оповещения о новом
    // решении, на миг показывала «вопроса нет», пока список ещё грузился (16.10.2026).
    try {
      if (!hidden) loading.value = true
      const loadedData = await api.loadAgenda(data);
      if (seq < appliedSeq) {
        if (!hidden) loading.value = false
        return loadedAgenda.value;
      }
      appliedSeq = seq
      loadedAgenda.value = loadedData;
      // Подтверждённые вопросы убираем из буфера: authoritative-данные пришли.
      if (createdBuffer.value.length) createdBuffer.value = notLoaded(createdBuffer.value, loadedData)
      if (!hidden) loading.value = false
      return loadedData;
    } catch (error) {
      if (!hidden) loading.value = false
      throw error;
    }
  };

  // Обновление повестки по требованию: кнопка в шапке и дозагрузка после
  // действия пайщика. Живёт в сторе, а не на странице, потому что кнопка
  // рендерится в топбаре — вне дерева страницы, — и оба пути обязаны делить
  // одно состояние загрузки и один guard.
  //
  // Ошибку наружу не отдаём: обновление списка фоновое, и его падение не должно
  // выглядеть как несостоявшееся действие пайщика (см. C28-41 — из-за этого
  // таймаут обновления показывался как провал голоса).
  const refreshing = ref(false)

  const refresh = async (data: IGetAgendaInput): Promise<void> => {
    if (refreshing.value) return

    refreshing.value = true
    try {
      await loadAgenda(data, true)
    } catch (e) {
      console.error('[agenda] обновление повестки не удалось', e)
    } finally {
      refreshing.value = false
    }
  }

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
    refreshing,
    loadAgenda,
    refresh,
    insertCreated
  }
})
