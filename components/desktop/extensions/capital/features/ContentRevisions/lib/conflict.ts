/**
 * Конфликт редакций с сервера: мутация отклонена с `extensions.code = CONTENT_CONFLICT`,
 * в `extensions.conflict` — обе версии и текст с маркерами. Ничего не сохранено.
 */
export interface IContentConflict {
  entity_type: string
  entity_hash: string
  base_rev: number
  current_rev: number
  title_conflict: boolean
  description_conflict: boolean
  ours: { title: string; description: string }
  theirs: { title: string; description: string }
  base: { title: string; description: string } | null
  marked: string
}

export const CONTENT_CONFLICT_CODE = 'CONTENT_CONFLICT'

/** Достаёт конфликт из ошибки SDK (GraphQLError с response.errors[].extensions). */
export function extractContentConflict(error: unknown): IContentConflict | null {
  const response = (error as { response?: { errors?: unknown[] } } | null)?.response
  const errors = Array.isArray(response?.errors) ? response!.errors : Array.isArray((error as any)?.errors) ? (error as any).errors : []
  for (const e of errors as Array<{ extensions?: { code?: string; conflict?: IContentConflict } }>) {
    if (e?.extensions?.code === CONTENT_CONFLICT_CODE && e.extensions.conflict) {
      return e.extensions.conflict
    }
  }
  return null
}
