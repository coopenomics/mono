/**
 * Фаза 05 — подпись оферты ЦПП «Стол заказов» рабочими пайщиками (L3).
 *
 * Без этой подписи пайщик на столе бесправен: `market/catalog` отбивается
 * маршрутизатором на `/permission-denied` ещё до отрисовки — грант выдаётся
 * только тому, кто принял оферту. Гейт первого входа при этом не показывается,
 * поэтому симптом читается как поломка интерфейса, а не как непройденный
 * онбординг.
 *
 * Почему фазой, а не шагом сценария: прохождение гейта — отдельный
 * документируемый путь (сценарий onboarding/extension-gate, он берёт свежего
 * пайщика из пула). Рабочим фикстурам гейт проходить незачем — им нужен
 * результат, иначе каждый сценарий начинался бы с чужого онбординга.
 *
 * Подписываем напрямую `wallet::signagree` тем же способом, что и сервис
 * `signOnboardingOffer`: program_id и draft_id берём из
 * `soviet::coagreements(coopname, type='marketplace')`. Через контроллер идти
 * нельзя — мутация требует подписанный инстанс документа, а его генерация
 * ключом пайщика к подготовке стенда отношения не имеет.
 *
 * Идемпотентна: наличие program_id в `wallet::users[].programs[]` проверяется
 * до отправки, повторный прогон — no-op.
 */
import { Client as PgClient } from 'pg'
import { WalletContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'
import { fakeDocument } from '../../../tests/shared/fakeDocument'

const log = (...a: unknown[]) => console.error('[seed-marketplace:05]', ...a)

const COOPNAME = 'voskhod'
const MARKETPLACE_AGREEMENT_TYPE = 'marketplace'
/** Участок получения по умолчанию — тот же, к которому фаза 03 привязывает пайщиков. */
const BRANAME = 'krg'

/** Пайщики, работающие на столах: заказчик, поставщик, председатель участка. */
const MEMBERS = ['ekaterina', 'ivanpetrov', 'chairkrg']

interface CoagreementRow {
  type: string
  coopname: string
  program_id: number | string
  draft_id: number | string
}

interface WalletUserRow {
  username: string
  programs: Array<{ program_id: number | string }>
}

export async function phase05(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const coagreements = (await blockchain.getTableRows(
    'soviet', COOPNAME, 'coagreements', 100,
  )) as CoagreementRow[]

  const agreement = coagreements.find(r => r.type === MARKETPLACE_AGREEMENT_TYPE)
  if (!agreement) {
    throw new Error(
      `в кооперативе ${COOPNAME} нет соглашения типа '${MARKETPLACE_AGREEMENT_TYPE}' — сначала фаза 01-l1-accept`,
    )
  }

  const programId = Number(agreement.program_id)
  const draftId = Number(agreement.draft_id)
  if (programId <= 0) {
    throw new Error(
      `соглашение '${MARKETPLACE_AGREEMENT_TYPE}' без программного кошелька (program_id=${programId})`,
    )
  }

  for (const username of MEMBERS) {
    const users = (await blockchain.getTableRows(
      'wallet', COOPNAME, 'users', 1000,
    )) as WalletUserRow[]

    const signed = users
      .find(r => r.username === username)
      ?.programs?.some(p => Number(p.program_id) === programId)

    if (signed) {
      log(`${username}: оферта ЦПП уже подписана — пропуск`)
      continue
    }

    const data: WalletContract.Actions.SignAgreement.ISignAgreement = {
      coopname: COOPNAME,
      username,
      program_id: programId,
      document: fakeDocument as never,
      draft_id: draftId,
    }

    await blockchain.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.SignAgreement.actionName,
        authorization: [{ actor: COOPNAME, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    log(`${username}: оферта ЦПП подписана (program_id=${programId}, draft_id=${draftId})`)
  }

  await ensureDeliveryBranch()
}

/**
 * Второе условие L3-гейта заказчика — выбранный участок получения.
 *
 * Провайдер грантов держит гейт, пока верно `requires_gate || !cart.delivery_braname`:
 * подписи оферты мало, потому что подписать её могли ещё на регистрации, где
 * выбора участка не было вовсе. Без записи в корзине пайщик остаётся с одним
 * `Onboarding:orderer`, и каталог отдаёт «Недостаточно прав доступа».
 *
 * В интерфейсе участок выбирается диалогом первого входа; здесь пишем прямо в
 * корзину — выбор ПВЗ проверяется своим сценарием, а не каждым подряд.
 */
async function ensureDeliveryBranch(): Promise<void> {
  const pg = new PgClient({
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })
  await pg.connect()
  try {
    for (const username of MEMBERS) {
      const res = await pg.query(
        `INSERT INTO marketplace_cart (coopname, orderer_account, delivery_braname)
         VALUES ($1, $2, $3)
         ON CONFLICT (coopname, orderer_account)
         DO UPDATE SET delivery_braname = COALESCE(marketplace_cart.delivery_braname, EXCLUDED.delivery_braname),
                       updated_at = now()
         RETURNING delivery_braname`,
        [COOPNAME, username, BRANAME],
      )
      log(`${username}: участок получения — ${res.rows[0]?.delivery_braname}`)
    }
  }
  finally {
    await pg.end()
  }
}
