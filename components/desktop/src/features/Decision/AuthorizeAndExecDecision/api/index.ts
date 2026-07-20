import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import type { IAuthorizeDecisionInput } from '../model'

/**
 * Утверждение и исполнение решения совета через GraphQL-мутацию `authorizeDecision`.
 *
 * Раньше тут был прямой `transact([authorize, exec])` от имени председателя из
 * браузера. Теперь действие проводится через контроллер ключом кооператива
 * (`soviet::authorize`/`exec` переведены на `require_auth(coopname)`), поэтому
 * ошибки связи с блокчейном видны в логах бэкенда, а не теряются в браузере.
 * Подпись председателя на документе сохраняется и проверяется контрактом
 * через `verify_document_or_fail`.
 */
async function authorizeDecision(data: IAuthorizeDecisionInput) {
  const { [Mutations.Decisions.AuthorizeDecision.name]: result } = await client.Mutation(
    Mutations.Decisions.AuthorizeDecision.mutation,
    { variables: { data } }
  )
  return result
}

export const api = {
  authorizeDecision,
}
