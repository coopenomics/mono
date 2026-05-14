import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { Mutations } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import { DigitalDocument } from 'src/shared/lib/document'
import type { IDocument } from 'src/shared/lib/types/document'
import type {
  IDocumentSigningOptions,
  ISigningDocument,
} from './types'

export interface IDocumentSigningController {
  documents: Ref<ISigningDocument[]>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  allAccepted: ComputedRef<boolean>
  linkHashes: ComputedRef<string[]>
  load: () => Promise<ISigningDocument[]>
  setAccepted: (id: string, accepted: boolean) => void
  signAll: (
    username: string,
    onProgress?: (message: string) => void
  ) => Promise<ISigningDocument[]>
  getById: (id: string) => ISigningDocument | undefined
  reset: () => void
}

/**
 * Платформенный composable для генерации и подписи пакета документов
 * пайщика. Работает на локальном state (без Pinia) — можно инстанциировать
 * независимо в любом месте: и в Registrator, и на странице расширения,
 * которое онбордит пайщика по своему flow.
 *
 * Не решает «когда показывать» — это делает место вызова. Composable
 * только генерирует пачку, отслеживает галочки и подписывает все
 * документы за один проход подписи.
 */
export function useDocumentSigning(
  getOpts: () => IDocumentSigningOptions
): IDocumentSigningController {
  const documents = ref<ISigningDocument[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const allAccepted = computed(() => {
    if (documents.value.length === 0) return false
    return documents.value.every((d) => d.accepted)
  })

  const linkHashes = computed<string[]>(() => {
    return documents.value
      .filter((d) => d.link_to_statement && d.signed_document)
      .map((d) => (d.signed_document as IDocument).doc_hash)
      .filter((h): h is string => Boolean(h))
  })

  const load = async (): Promise<ISigningDocument[]> => {
    const { coopname, username, accountType, programKey } = getOpts()
    isLoading.value = true
    error.value = null
    try {
      const { [Mutations.Registration.GenerateRegistrationDocuments.name]: output } =
        await client.Mutation(
          Mutations.Registration.GenerateRegistrationDocuments.mutation,
          {
            variables: {
              data: {
                coopname,
                username,
                account_type: accountType,
                program_key: programKey,
              },
            },
          }
        )

      documents.value = output.documents.map((d) => ({
        ...d,
        accepted: false,
        signed_document: undefined,
      }))

      return documents.value
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      throw error.value
    } finally {
      isLoading.value = false
    }
  }

  const setAccepted = (id: string, accepted: boolean) => {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) doc.accepted = accepted
  }

  const signAll = async (
    username: string,
    onProgress?: (message: string) => void
  ): Promise<ISigningDocument[]> => {
    for (const doc of documents.value) {
      onProgress?.(`Подписываем ${doc.title}`)
      const digital = new DigitalDocument(doc.document)
      doc.signed_document = await digital.sign(username)
    }
    return [...documents.value]
  }

  const getById = (id: string): ISigningDocument | undefined => {
    return documents.value.find((d) => d.id === id)
  }

  const reset = () => {
    documents.value = []
    error.value = null
  }

  return {
    documents,
    isLoading,
    error,
    allAccepted,
    linkHashes,
    load,
    setAccepted,
    signAll,
    getById,
    reset,
  }
}
