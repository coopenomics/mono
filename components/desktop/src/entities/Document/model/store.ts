import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { api } from '../api'
import type { DocumentType, IGetDocuments, IPagination, IDocumentPackageAggregate } from './types'
import { FailAlert } from 'src/shared/api'

const namespace = 'documentStore'

interface IDocumentStore {
  documents: Ref<IDocumentPackageAggregate[]>
  loading: Ref<boolean>
  documentType: Ref<DocumentType>
  pagination: Ref<IPagination>
  changePage: (page: number, username: string, filter: Record<string, any>, hidden?: boolean) => Promise<IDocumentPackageAggregate[]>
  changeDocumentType: (type: DocumentType, username: string, filter: Record<string, any>) => Promise<void>
  loadDocument: (username: string, hash: string) => Promise<IDocumentPackageAggregate | null>
  resetDocuments: () => void
}
/**
 * Хранилище для работы с документами
 */
export const useDocumentStore = defineStore(namespace, (): IDocumentStore => {
  const documents = ref<IDocumentPackageAggregate[]>([])
  const loading = ref(false)
  const documentType = ref<DocumentType>('newsubmitted')

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
        limit: 10
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

  return {
    documents,
    loading,
    documentType,
    pagination,
    changePage,
    changeDocumentType,
    loadDocument,
    resetDocuments
  }
})
