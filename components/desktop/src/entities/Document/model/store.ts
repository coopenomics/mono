import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { api } from '../api'
import type { DocumentType, IGetDocuments, IPagination, IDocumentPackageAggregate } from './types'
import { FailAlert } from 'src/shared/api'
import { liveWindow } from 'src/shared/lib/realtime'

const PAGE_SIZE = 10

const namespace = 'documentStore'

interface IDocumentStore {
  documents: Ref<IDocumentPackageAggregate[]>
  loading: Ref<boolean>
  documentType: Ref<DocumentType>
  pagination: Ref<IPagination>
  changePage: (page: number, username: string, filter: Record<string, any>, hidden?: boolean) => Promise<IDocumentPackageAggregate[]>
  changeDocumentType: (type: DocumentType, username: string, filter: Record<string, any>) => Promise<void>
  loadDocument: (username: string, hash: string) => Promise<IDocumentPackageAggregate | null>
  loadPackage: (username: string, packageHash: string) => Promise<IDocumentPackageAggregate | null>
  resetDocuments: () => void
  reloadLoaded: (username: string, filter: Record<string, any>) => Promise<void>
  /** Вид выдачи и фильтры журнала: пакеты или каждый документ, период подписи, типы документов. */
  listOptions: Ref<IDocumentListOptions>
  setListOptions: (options: Partial<IDocumentListOptions>, username: string, filter: Record<string, any>) => Promise<void>
}

/** Вид выдачи и фильтры реестра документов. */
export interface IDocumentListOptions {
  view: 'PACKAGE' | 'FLAT'
  signed_from: string | null
  signed_to: string | null
  registry_ids: number[]
}
/**
 * Хранилище для работы с документами
 */
export const useDocumentStore = defineStore(namespace, (): IDocumentStore => {
  const documents = ref<IDocumentPackageAggregate[]>([])
  const loading = ref(false)
  const documentType = ref<DocumentType>('newsubmitted')
  const listOptions = ref<IDocumentListOptions>({ view: 'PACKAGE', signed_from: null, signed_to: null, registry_ids: [] })

  /** Поля запроса по виду и фильтрам; пустые фильтры в запрос не попадают. */
  const optionFields = () => ({
    view: listOptions.value.view as IGetDocuments['view'],
    ...(listOptions.value.signed_from ? { signed_from: listOptions.value.signed_from } : {}),
    ...(listOptions.value.signed_to ? { signed_to: listOptions.value.signed_to } : {}),
    ...(listOptions.value.registry_ids.length ? { registry_ids: listOptions.value.registry_ids } : {}),
  })

  // Информация о пагинации
  const pagination = ref<IPagination>({
    totalCount: 0,
    totalPages: 0,
    currentPage: 1
  })

  /**
   * Сброс состояния документов
   */
  const resetDocuments = () => {
    documents.value = []
    pagination.value = {
      totalCount: 0,
      totalPages: 0,
      currentPage: 1
    }
  }

  /**
   * Изменяет страницу для пагинации и загружает данные
   * @param page номер страницы
   * @param username имя пользователя или кооператива
   * @param filter параметры фильтрации
   * @param hidden флаг скрытой загрузки (без индикатора)
   * @returns массив документов
   */
  const changePage = async (
    page: number,
    username: string,
    filter: Record<string, any>,
    hidden = false
  ): Promise<IDocumentPackageAggregate[]> => {
    try {
      loading.value = hidden ? false : true

      pagination.value.currentPage = page

      const data: IGetDocuments = {
        username,
        filter,
        type: documentType.value,
        page: page,
        limit: PAGE_SIZE,
        ...optionFields()
      }

      const result = await api.loadDocuments(data)

      // Если это первая страница, заменяем документы
      // Иначе добавляем новые документы к существующим
      if (page === 1) {
        documents.value = result.items
      } else {
        documents.value = [...documents.value, ...result.items]
      }

      // Обновляем информацию о пагинации
      pagination.value = {
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage
      }

      loading.value = false
      return documents.value
    } catch (error: any) {
      loading.value = false
      console.error('Error loading documents:', error)
      FailAlert(error)
      return []
    }
  }

  /**
   * Изменяет тип документов для отображения
   */
  const changeDocumentType = async (type: DocumentType, username: string, filter: Record<string, any>) => {
    documentType.value = type
    // Сбрасываем текущую страницу при смене типа и загружаем документы
    await changePage(1, username, filter)
  }

  /**
   * Загружает один документ по hash — для отдельной страницы документа.
   * Не трогает состояние списка. Тип newsubmitted — статус-агностичный фильтр
   * (находит документ в любом статусе: подан / решён / аннулирован).
   * @param username скоуп выборки: coopname (весь кооператив) или имя пайщика
   * @param hash хэш документа (в реестре хранится в верхнем регистре)
   * @returns агрегат пакета документа или null, если не найден
   */
  const loadDocument = async (
    username: string,
    hash: string
  ): Promise<IDocumentPackageAggregate | null> => {
    const result = await api.loadDocuments({
      username,
      filter: { document: { hash: hash.toUpperCase() } },
      type: 'newsubmitted',
      page: 1,
      limit: 1
    })
    return result.items[0] ?? null
  }

  /**
   * Пакет документов процесса по его хэшу — тому, что стоит в операциях учёта
   * (`process_hash`). Хэш документа-заявления в пакете другой, поэтому
   * `loadDocument` здесь не подходит.
   */
  const loadPackage = async (
    username: string,
    packageHash: string
  ): Promise<IDocumentPackageAggregate | null> => {
    const result = await api.loadDocuments({
      username,
      filter: { package: packageHash.toUpperCase() },
      type: 'newsubmitted',
      page: 1,
      limit: 1
    })
    return result.items[0] ?? null
  }

  /**
   * Перечитать уже показанные страницы одним запросом и заменить список:
   * так список живёт по ленте изменений — новый документ встаёт на место,
   * решения и аннулирования обновляются. Тихо: без индикатора и без
   * всплывающей ошибки, следующий сигнал повторит.
   */
  const reloadLoaded = async (username: string, filter: Record<string, any>): Promise<void> => {
    const window = liveWindow(pagination.value.currentPage, PAGE_SIZE)
    try {
      const result = await api.loadDocuments({
        username,
        filter,
        type: documentType.value,
        ...window.options,
        ...optionFields(),
      })
      documents.value = result.items
      pagination.value = {
        totalCount: result.totalCount,
        totalPages: Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE)),
        currentPage: window.pages,
      }
    } catch (error) {
      console.warn('[documents] фоновое перечитывание не удалось', error)
    }
  }

  /** Новый вид выдачи или фильтр — реестр перечитывается с первой страницы. */
  const setListOptions = async (
    options: Partial<IDocumentListOptions>,
    username: string,
    filter: Record<string, any>
  ): Promise<void> => {
    listOptions.value = { ...listOptions.value, ...options }
    await changePage(1, username, filter)
  }

  return {
    listOptions,
    setListOptions,
    documents,
    loading,
    documentType,
    pagination,
    changePage,
    changeDocumentType,
    loadDocument,
    loadPackage,
    resetDocuments,
    reloadLoaded
  }
})
