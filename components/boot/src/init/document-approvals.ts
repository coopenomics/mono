import type { Cooperative } from 'cooptypes'
import type Blockchain from '../blockchain'

/**
 * Утверждения документов базового набора и приложений для локальной сети.
 *
 * Фабрика утверждений предъявляет пайщикам только редакцию, утверждённую
 * советом кооператива (`draft::approvals`). Загрузчик заводит кооператив с
 * реквизитами протоколов в `vars`, значит те же документы должны считаться
 * утверждёнными в текущей редакции сети — иначе автотесты онбординга и
 * подписания не увидят ни одного соглашения.
 *
 * Соответствие «поле vars → документы» повторяет декларации контроллера:
 * базовый набор ядра, Капитал, Стол заказов. Номер протокола, если он не
 * число, записывается нулём — перенос без номера контракт допускает.
 */
const VARS_FIELD_TO_DOCUMENTS: Record<string, number[]> = {
  wallet_agreement: [1],
  signature_agreement: [2],
  privacy_agreement: [3],
  user_agreement: [4],
  coopenomics_agreement: [50],
  participant_application: [100, 101],
  generator_program: [994],
  generation_contract_template: [1001],
  generator_offer_template: [996],
  blagorost_program: [998],
  blagorost_offer_template: [1000],
  marketplace_provision: [1100],
  marketplace_offer_template: [1102],
}

const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

function toChainTimePoint(value: string): string {
  const short = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(value.trim())
  if (short)
    return `${short[3]}-${short[2]}-${short[1]}T${short[4] ?? '00'}:${short[5] ?? '00'}:00`
  const long = /^(\d{1,2})\s+(\p{Script=Cyrillic}+)\s+(\d{4})/iu.exec(value.trim())
  if (long) {
    const month = RU_MONTHS.indexOf(long[2]!.toLowerCase())
    if (month >= 0)
      return `${long[3]}-${String(month + 1).padStart(2, '0')}-${long[1]!.padStart(2, '0')}T00:00:00`
  }
  return new Date().toISOString().slice(0, 19)
}

export async function seedDocumentApprovals(blockchain: Blockchain, coopname: string, vars: Cooperative.Model.IVars): Promise<void> {
  const existing = await blockchain.getTableRows('draft', coopname, 'approvals', 1000)
  const approved = new Set<number>(existing.map((row: { registry_id: string | number }) => Number(row.registry_id)))
  let count = 0

  for (const [field, registryIds] of Object.entries(VARS_FIELD_TO_DOCUMENTS)) {
    const requisites = (vars as unknown as Record<string, { protocol_number?: string, protocol_day_month_year?: string } | undefined>)[field]
    if (!requisites?.protocol_number || !requisites.protocol_day_month_year)
      continue

    for (const registry_id of registryIds) {
      if (approved.has(registry_id))
        continue
      const [draft] = await blockchain.getTableRows('draft', 'draft', 'drafts', 1, String(registry_id), String(registry_id))
      if (!draft)
        continue

      await blockchain.api.transact({
        actions: [{
          account: 'draft',
          name: 'approve',
          authorization: [{ actor: coopname, permission: 'active' }],
          data: {
            coopname,
            username: coopname,
            registry_id,
            version: Number(draft.version),
            decision_id: /^\d+$/.test(requisites.protocol_number) ? Number(requisites.protocol_number) : 0,
            approved_at: toChainTimePoint(requisites.protocol_day_month_year),
            text_hash: '0'.repeat(64),
          },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      count += 1
    }
  }

  console.log(`Утверждения документов кооператива ${coopname} записаны: ${count}`)
}
