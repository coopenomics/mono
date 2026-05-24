/**
 * Регистрирует организацию кооперативного участка через GraphQL-мутацию
 * `editBranch` (тот же серверный путь, что фронтовый createBranch:
 * interactor.editBranch → organizationRepository.create). Нужен потому,
 * что branch krg уже создан on-chain (createBranch бросил бы «уже
 * создан»), а организация в Mongo контроллера отсутствует — из-за чего
 * фабрика документов 1102 (Акт приёмки) падает «Организация не найдена».
 *
 * Запуск (mono-ai-4):
 *   API_URL=http://127.0.0.1:3028/v1/graphql \
 *   CHAIN_URL=http://127.0.0.1:8918 \
 *   SERVER_SECRET=SECRET \
 *     pnpm --filter @coopenomics/boot exec esno src/scripts/fix-ku-org.ts
 */
import { gql, loginAsChairman } from '../tests/shared/apiClient'

const COOP = 'voskhod'
const BRANCHES = [
  {
    braname: 'krg',
    trustee: 'chairkrg',
    short_name: 'КУ Красногорск',
    full_name: 'Кооперативный участок «Красногорск»',
    fact_address: 'Московская область, г. Красногорск, ул. Заводская, д. 1',
    phone: '+79991230101',
    email: 'krg@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
]

// Банковский реквизит КУ — копия дефолтного банка кооператива (КУ не
// отдельное юрлицо, действует от реквизитов кооператива). createBranch
// создаёт его автоматически, editBranch — нет, поэтому добавляем явно.
const COOP_BANK = {
  currency: 'RUB',
  card_number: '',
  bank_name: 'ПАО Сбербанк',
  account_number: '40703810038000110117',
  details: { bik: '044525225', corr: '30101810400000000225', kpp: '773643001' },
}

async function main() {
  const { token, username } = await loginAsChairman()
  console.error('[fix-ku-org] logged in as', username)

  const addPm = `mutation($d:AddPaymentMethodInput!){ addPaymentMethod(data:$d){ method_id } }`
  const editBranch = `mutation($d:EditBranchInput!){ editBranch(data:$d){ braname } }`
  for (const b of BRANCHES) {
    try {
      const pm = await gql(token, addPm, {
        d: { username: b.braname, is_default: true, bank_transfer_data: COOP_BANK },
      })
      console.error('[fix-ku-org] addPaymentMethod', b.braname, 'OK', JSON.stringify(pm))
    } catch (e: any) {
      console.error('[fix-ku-org] addPaymentMethod', b.braname, 'FAILED:', e.message ?? e)
    }
    try {
      const res = await gql(token, editBranch, { d: { coopname: COOP, ...b } })
      console.error('[fix-ku-org] editBranch', b.braname, 'OK', JSON.stringify(res))
    } catch (e: any) {
      console.error('[fix-ku-org] editBranch', b.braname, 'FAILED:', e.message ?? e)
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
