/**
 * Seed-скрипт для трёх кооперативных участков Подмосковья:
 *   krg — Красногорск, председатель chairkrg
 *   odn — Одинцово,  председатель chairodn
 *   myt — Мытищи,    председатель chairmyt
 * + доверенное лицо trustedkrg для КУ Красногорск.
 *
 * Делает:
 *   1. eosio::newaccount для каждого braname (если ещё не существует).
 *   2. branch::createbranch (actor=coopname active).
 *   3. branch::addtrusted для krg → trustedkrg.
 *   4. Mongo organization upsert (short_name + контакты, для desktop UI).
 *
 * Использование:
 *   MONGO_URI=mongodb://127.0.0.1:27017/cooperative-x \
 *     pnpm --filter @coopenomics/boot exec esno \
 *     src/scripts/seed-marketplace-branches.ts
 */
import { randomUUID } from 'node:crypto'
import { BranchContract, type Cooperative } from 'cooptypes'
import { Generator } from '@coopenomics/factory'
import Blockchain from '../blockchain'
import config from '../configs'

const log = (...a: unknown[]) => console.error('[seed-branches]', ...a)

interface BranchSeed {
  braname: string
  trustee: string
  short_name: string
  full_name: string
  city: string
  fact_address: string
  phone: string
  email: string
  based_on: string
}

const BRANCHES: BranchSeed[] = [
  {
    braname: 'krg',
    trustee: 'chairkrg',
    short_name: 'КУ Красногорск',
    full_name: 'Кооперативный участок «Красногорск»',
    city: 'Красногорск',
    fact_address: 'Московская область, г. Красногорск, ул. Заводская, д. 1',
    phone: '+79991230101',
    email: 'krg@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'odn',
    trustee: 'chairodn',
    short_name: 'КУ Одинцово',
    full_name: 'Кооперативный участок «Одинцово»',
    city: 'Одинцово',
    fact_address: 'Московская область, г. Одинцово, ул. Центральная, д. 12',
    phone: '+79991230202',
    email: 'odn@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'myt',
    trustee: 'chairmyt',
    short_name: 'КУ Мытищи',
    full_name: 'Кооперативный участок «Мытищи»',
    city: 'Мытищи',
    fact_address: 'Московская область, г. Мытищи, Олимпийский проспект, д. 5',
    phone: '+79991230303',
    email: 'myt@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
]
const TRUSTED_KRG = ['trustedkrg']

async function main() {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const coopname = config.provider

  // === 1. Mongo organization upsert для каждого КУ ===
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI не задан')
  const generator = new Generator()
  await generator.connect(mongoUri)

  for (const b of BRANCHES) {
    const orgData: Cooperative.Users.IOrganizationData = {
      username: b.braname,
      type: 'coop',
      short_name: b.short_name,
      full_name: b.full_name,
      represented_by: {
        first_name: '',
        last_name: '',
        middle_name: '',
        position: 'председатель кооперативного участка',
        based_on: b.based_on,
      },
      country: 'Российская Федерация',
      city: b.city,
      fact_address: b.fact_address,
      full_address: b.fact_address,
      email: b.email,
      phone: b.phone,
      details: { inn: '', ogrn: '', kpp: '' },
    }
    try {
      await generator.save('organization', orgData)
      log(`mongo organization ${b.braname} upserted`)

      // Банковские реквизиты участка. Без них карточка участка не собирается:
      // BranchInteractor.getBranch строит BankPaymentMethodDTO из метода оплаты
      // и падает на null, а getBranches ловит это как «участок ещё не
      // материализован» и молча выкидывает его из списка. Симптом — пустой
      // выпадающий список в диалоге выбора участка при живых записях в цепи.
      // В боевом потоке реквизиты вводит председатель при создании участка.
      const hasMethod = await generator.get?.('paymentMethod', { username: b.braname })
      if (!hasMethod) {
        await generator.save('paymentMethod', {
          is_default: true,
          method_id: randomUUID(),
          method_type: 'bank_transfer',
          username: b.braname,
          data: {
            account_number: '40703810038000110117',
            currency: 'RUB',
            card_number: '',
            bank_name: 'ПАО Сбербанк',
            details: { bik: '044525225', corr: '30101810400000000225', kpp: '773643001' },
          },
        })
        log(`mongo paymentMethod ${b.braname} создан`)
      }
    } catch (e: any) {
      log(`mongo organization ${b.braname} failed: ${e.message ?? e}`)
    }
  }

  // === 2. ончейн createbranch (actor=coopname active, ключ кооператива) ===
  for (const b of BRANCHES) {
    try {
      // Проверяем не существует ли КУ уже on-chain
      const existing = await blockchain.api.rpc.get_table_rows({
        code: 'branch',
        scope: coopname,
        table: 'branches',
        lower_bound: b.braname,
        upper_bound: b.braname,
        limit: 1,
      }).catch(() => ({ rows: [] }))
      if (existing.rows && existing.rows.length > 0) {
        log(`skip createbranch ${b.braname} (already on-chain)`)
        continue
      }

      const data: BranchContract.Actions.CreateBranch.ICreateBranch = {
        coopname,
        braname: b.braname,
        trustee: b.trustee,
      }
      await blockchain.api.transact({
        actions: [{
          account: BranchContract.contractName.production,
          name: BranchContract.Actions.CreateBranch.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      log(`createbranch ${b.braname} → trustee=${b.trustee} OK`)
    } catch (e: any) {
      log(`createbranch ${b.braname} failed: ${e.message ?? e}`)
    }
  }

  // === 3. addtrusted для krg ===
  for (const trusted of TRUSTED_KRG) {
    try {
      const data: BranchContract.Actions.AddTrusted.IAddTrusted = {
        coopname,
        braname: 'krg',
        trusted,
      }
      await blockchain.api.transact({
        actions: [{
          account: BranchContract.contractName.production,
          name: BranchContract.Actions.AddTrusted.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
      log(`addtrusted krg ← ${trusted} OK`)
    } catch (e: any) {
      log(`addtrusted ${trusted} failed: ${e.message ?? e}`)
    }
  }

  await generator.close?.()
  log('done')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
