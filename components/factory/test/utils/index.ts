import path from 'node:path'
import type { RegistratorContract, SovietContract } from 'cooptypes'
import { Generator, Registry } from '../../src'
import type { ExternalEntrepreneurData, ExternalIndividualData, ExternalOrganizationData, IVars, PaymentData } from '../../src/Models'
import { MongoDBConnector } from '../../src/Services/Databazor'
// eslint-disable-next-line ts/no-require-imports
const fs = require('node:fs').promises

export const mongoUri = process.env.MONGO_URI || `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}:27017/cooperative-x`
export const coopname = 'voskhod'

export const generator = new Generator()

export async function deleteAllFiles(folderPath: string) {
  try {
    const absolutePath = path.resolve(folderPath)
    const files = await fs.readdir(absolutePath)

    for (const file of files) {
      const filePath = path.join(absolutePath, file)
      const stat = await fs.stat(filePath)

      if (stat.isFile()) {
        await fs.unlink(filePath) // Удаляет файл
        console.log(`Deleted: ${filePath}`)
      }
    }
    console.log('All files deleted successfully.')
  }
  catch (err: any) {
    console.error(`Error while deleting files: ${err.message}`)
  }
}

export async function preLoading() {
  await deleteAllFiles('./documents')

  const storage = new MongoDBConnector(mongoUri)
  await storage.connect()

  const collectionsToClear = [
    'vars',
    'paymentMethods',
    'individuals',
    'organizations',
    'entrepreneurs',
    'projects',
    'udatas',
    'deltas',
    'actions',
    'doc_private_data',
  ]

  for (const collectionName of collectionsToClear) {
    const collection = storage.getCollection(collectionName)
    await collection.deleteMany({})
  }

  const deltas = storage.getCollection('deltas')
  const actions = storage.getCollection('actions')

  const draft = await deltas.findOne({ code: 'draft', scope: 'draft', table: 'drafts' })
  const translation = await deltas.findOne({ code: 'draft', scope: 'draft', table: 'translation' })

  // устанавливаем только если нет
  if (draft && translation)
    return

  let i = 0
  for (const [key, value] of Object.entries(Registry)) {
    i++
    await deltas.insertOne({
      block_num: 0,
      present: true,
      code: 'draft',
      scope: 'draft',
      table: 'drafts',
      primary_key: String(i),
      value: {
        id: String(i),
        registry_id: String(key),
        version: 1,
        default_translation_id: String(i),
        title: value.Template.title,
        description: value.Template.description,
        context: value.Template.context,
        model: JSON.stringify(value.Template.model),
      },
    })

    await deltas.insertOne({
      block_num: 0,
      present: true,
      code: 'draft',
      scope: 'draft',
      table: 'translations',
      primary_key: String(i),
      value: {
        id: String(i),
        draft_id: String(i),
        lang: 'ru',
        data: JSON.stringify(value.Template.translations.ru),
      },
    })

    const cooperative_is_exist = await deltas.findOne({
      'block_num': 0,
      'value.username': 'voskhod',
    })

    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'votefor',
      receiver: 'soviet',
      data: {
        version: '1.0.0',
        coopname: 'voskhod',
        username: 'ant',
        decision_id: '1',
        signed_at: '2024-01-01T00:00:00.000Z',
        signed_hash: 'hash',
        signature: 'signature',
        public_key: 'public_key',
      } as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
    })

    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'votefor',
      receiver: 'soviet',
      data: {
        version: '1.0.0',
        coopname: 'voskhod',
        username: 'ant',
        decision_id: '2',
        signed_at: '2024-01-01T00:00:00.000Z',
        signed_hash: 'hash',
        signature: 'signature',
        public_key: 'public_key',
      } as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
    })

    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'votefor',
      receiver: 'soviet',
      data: {
        version: '1.0.0',
        coopname: 'voskhod',
        username: 'ant',
        decision_id: '3',
        signed_at: '2024-01-01T00:00:00.000Z',
        signed_hash: 'hash',
        signature: 'signature',
        public_key: 'public_key',
      } as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
    })

    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'votefor',
      receiver: 'soviet',
      data: {
        version: '1.0.0',
        coopname: 'voskhod',
        username: 'ant',
        decision_id: '4',
        signed_at: '2024-01-01T00:00:00.000Z',
        signed_hash: 'hash',
        signature: 'signature',
        public_key: 'public_key',
      } as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
    })

    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'votefor',
      receiver: 'soviet',
      data: {
        version: '1.0.0',
        coopname: 'voskhod',
        username: 'ant',
        decision_id: '5',
        signed_at: '2024-01-01T00:00:00.000Z',
        signed_hash: 'hash',
        signature: 'signature',
        public_key: 'public_key',
      } as SovietContract.Actions.Decisions.VoteFor.IVoteForDecision,
    })

    if (!cooperative_is_exist) {
      await deltas.insertOne({
        block_num: 0,
        present: true,
        code: 'registrator',
        scope: 'registrator',
        table: 'coops',
        primary_key: '1',
        value: {
          username: 'voskhod',
          parent_username: '',
          announce: '',
          description: '',
          is_cooperative: true,
          is_branched: false,
          coop_type: 'conscoop',
          registration: '2.0000 RUB',
          initial: '1.0000 RUB',
          minimum: '1.0000 RUB',
          org_initial: '100.0000 RUB',
          org_minimum: '1000.0000 RUB',
          org_registration: '1100.0000 RUB',
        } as RegistratorContract.Tables.Cooperatives.ICooperative,
      })

      await deltas.insertOne({
        block_num: 0,
        present: true,
        code: 'soviet',
        scope: 'voskhod',
        table: 'boards',
        primary_key: '1',
        value: {
          id: '0',
          type: 'soviet',
          name: 'Совет провайдера',
          description: '',
          test: 1,
          members: [
            {
              username: 'ant',
              is_voting: true,
              position_title: 'Председатель',
              position: 'chairman',
            },
          ],
          created_at: '2024-05-15T10:45:42.000',
          last_update: '2024-05-15T10:45:42.000',
        } as SovietContract.Tables.Boards.IBoards,
      })
    }
  }

  const vars: IVars = {
    coopname: 'voskhod',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr_dative: 'Потребительскому Кооперативу',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    name: 'ВОСХОД',
    confidential_link: 'coopenomics.world/privacy',
    confidential_email: 'privacy@coopenomics.world',
    contact_email: 'contact@coopenomics.world',
    passport_request: 'yes',
    wallet_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    signature_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    privacy_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    user_agreement: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    participant_application: {
      protocol_number: '10-04-2024',
      protocol_day_month_year: '10 апреля 2024 г.',
    },
    generation_contract_template: {
      protocol_number: '10-05-2024',
      protocol_day_month_year: '10 мая 2024 г.',
    },
    blagorost_program: {
      protocol_number: '10-05-2024',
      protocol_day_month_year: '10 мая 2024 г.',
    },
    blagorost_offer_template: {
      protocol_number: '10-05-2024',
      protocol_day_month_year: '10 мая 2024 г.',
    },
    generator_program: {
      protocol_number: '11-05-2024',
      protocol_day_month_year: '11 мая 2024 г.',
    },
    generator_offer_template: {
      protocol_number: '11-05-2024',
      protocol_day_month_year: '11 мая 2024 г.',
    },
  }

  await generator.save('vars', vars)

  const userData: ExternalIndividualData = {
    username: 'ant',
    first_name: 'Иван',
    last_name: 'Иванов',
    middle_name: 'Иванович',
    birthdate: '2023-04-01',
    phone: '+71234567890',
    email: 'john.doe@example.com',
    full_address: 'Переулок Правды д. 1',
    passport: {
      series: 7122,
      number: 112233,
      issued_by: 'отделом УФМС по г. Москва',
      issued_at: '22.04.2010',
      code: '111-232',
    },
  }

  await generator.save('individual', userData)

  const userData2: ExternalIndividualData = {
    username: 'individual',
    first_name: 'Фёдор',
    last_name: 'Ушаков',
    middle_name: 'Кондратьевич',
    birthdate: '2023-04-02',
    phone: '+71234567891',
    email: 'ushakov@example.com',
    full_address: 'Переулок Ломоносва д. 1',
    passport: {
      series: 7142,
      number: 112333,
      issued_by: 'отделом УФМС по г. Москва',
      issued_at: '22.04.2011',
      code: '111-233',
    },
  }

  await generator.save('individual', userData2)

  const organizationData: ExternalOrganizationData = {
    username: 'voskhod',
    type: 'coop',
    short_name: '"ПК Восход"',
    full_name: 'Потребительский Кооператив "ВОСХОД"',
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      position: 'Председатель',
      based_on: 'Решение общего собрания №1',
    },
    country: 'Russia',
    city: 'Москва',
    full_address: '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    fact_address: '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    email: 'copenomics@yandex.ru',
    phone: '+771234567890',
    details: {
      inn: '9728130611',
      ogrn: '1247700283346',
      kpp: '772801001',
    },
  }

  await generator.save('organization', organizationData)

  await generator.get('organization', { username: organizationData.username }) as any

  const paymentData: PaymentData = {
    username: 'voskhod',
    method_id: '1',
    method_type: 'bank_transfer',
    is_default: true,
    data: {
      account_number: '40703810038000110117',
      currency: 'RUB',
      card_number: '',
      bank_name: 'ПАО Сбербанк',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    deleted: false,
  }

  await generator.save('paymentMethod', paymentData)

  const entrepreneurData: ExternalEntrepreneurData = {
    username: 'entrepreneur',
    first_name: 'Александр',
    last_name: 'Пушкин',
    middle_name: 'Сергеевич',
    birthdate: '2023-04-01',
    phone: '+71234567890',
    email: 'john.doe@example.com',
    full_address: 'переулок правды д. 1',
    country: 'Russia',
    city: 'Moscow',
    details: {
      inn: '0987654321',
      ogrn: '0987654321098',
    },
  }

  const saved = await generator.save('entrepreneur', entrepreneurData)
  console.log(saved)

  const paymentData2: PaymentData = {
    username: 'entrepreneur',
    method_id: '1',
    method_type: 'bank_transfer',
    is_default: true,
    data: {
      account_number: '40817810099910004312',
      currency: 'RUB',
      card_number: '0987654321098765',
      bank_name: 'Example Bank',
      details: {
        bik: '098765432',
        corr: '30101810400000000225',
      },
    },
    deleted: false,
  }

  await generator.save('paymentMethod', paymentData2)

  const branchData: ExternalOrganizationData = {
    username: 'branch',
    type: 'coop',
    short_name: '"КУ ПЕТРУШКА"',
    full_name: 'Кооперативный Участок "ПЕТРУШКА"',
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      position: 'Председатель кооперативного участка',
      based_on: 'Решение собрания совета №101',
    },
    country: 'Russia',
    city: 'Москва',
    full_address: '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    fact_address: '117593 г. Москва, муниципальный округ Ясенево, проезд Соловьиный, дом 1, помещение 1/1',
    email: 'copenomics@yandex.ru',
    phone: '+771234567890',
    details: {
      inn: '9728130611',
      ogrn: '1247700283346',
      kpp: '772801001',
    },
  }

  await generator.save('organization', branchData)

  const paymentData3: PaymentData = {
    username: 'branch',
    method_id: '1',
    method_type: 'bank_transfer',
    is_default: true,
    data: {
      account_number: '40703810038000110117',
      currency: 'RUB',
      card_number: '',
      bank_name: 'ПАО Сбербанк',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    deleted: false,
  }

  await generator.save('paymentMethod', paymentData3)

  const exampleOrganizationData: ExternalOrganizationData = {
    username: 'exampleorg',
    type: 'ooo',
    short_name: 'ООО "Ромашка"',
    full_name: 'Общество Ограниченной Ответственности "Ромашка"',
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      position: 'Директор',
      based_on: 'решения собрания учредителей №22',
    },
    country: 'Russia',
    city: 'Moscow',
    full_address: 'г. Москва, ул. Арбат д. 22, офис 306',
    fact_address: 'г. Москва, ул. Арбат д. 22, офис 306',
    email: 'contact@exampleorg.com',
    phone: '+771234567890',
    details: {
      kpp: '123456789',
      inn: '0987654321',
      ogrn: '0987654321098',
    },
  }

  await generator.save('organization', exampleOrganizationData)

  const paymentData4: PaymentData = {
    username: 'exampleorg',
    method_id: '1',
    method_type: 'bank_transfer',
    is_default: true,
    data: {
      account_number: '40817810099910004312',
      currency: 'RUB',
      card_number: '0987654321098765',
      bank_name: 'ПАО СБЕРБАНК',
      details: {
        bik: '098765432',
        corr: '30101810400000000225',
      },
    },
    deleted: false,
  }

  await generator.save('paymentMethod', paymentData4)

  // Добавляем данные для тестирования собраний
  const testMeetHash = ('test_meet_hash_12345').toUpperCase()
  const testMeetId = '1'

  // Добавляем данные собрания в таблицу meets
  await deltas.insertOne({
    block_num: 0,
    present: true,
    code: 'meet',
    scope: 'voskhod',
    table: 'meets',
    primary_key: testMeetId,
    value: {
      id: testMeetId,
      hash: testMeetHash,
      coopname: 'voskhod',
      type: 'regular',
      initiator: 'individual',
      presider: 'individual',
      secretary: 'ant',
      status: 'active',
      created_at: '2024-12-15T00:00:00.000',
      open_at: '2024-12-20T10:00:00.000',
      close_at: '2024-12-21T18:00:00.000',
      quorum_percent: 51,
      signed_ballots: '0',
      current_quorum_percent: '0',
      cycle: '1',
      quorum_passed: false,
      proposal: {
        version: '1.0.0',
        hash: 'proposal_hash',
        doc_hash: 'doc_hash',
        meta_hash: 'meta_hash',
        meta: '{}',
        signatures: [],
      },
      authorization: {
        version: '1.0.0',
        hash: 'auth_hash',
        doc_hash: 'auth_doc_hash',
        meta_hash: 'auth_meta_hash',
        meta: '{}',
        signatures: [],
      },
      decision1: {
        version: '1.0.0',
        hash: 'decision1_hash',
        doc_hash: 'decision1_doc_hash',
        meta_hash: 'decision1_meta_hash',
        meta: '{}',
        signatures: [],
      },
      decision2: {
        version: '1.0.0',
        hash: 'decision2_hash',
        doc_hash: 'decision2_doc_hash',
        meta_hash: 'decision2_meta_hash',
        meta: '{}',
        signatures: [],
      },
    },
  })

  // Добавляем вопросы собрания в таблицу questions
  await deltas.insertOne({
    block_num: 0,
    present: true,
    code: 'meet',
    scope: 'voskhod',
    table: 'questions',
    primary_key: '1',
    value: {
      id: '1',
      number: '1',
      coopname: 'voskhod',
      meet_id: testMeetId,
      title: 'Утверждение годового отчёта',
      context: 'О деятельности кооператива за 2024 год',
      decision: 'Утвердить годовой отчёт кооператива за 2024 год',
      counter_votes_for: '0',
      counter_votes_against: '1',
      counter_votes_abstained: '0',
      voters_for: [],
      voters_against: ['individual'],
      voters_abstained: [],
    },
  })

  await deltas.insertOne({
    block_num: 0,
    present: true,
    code: 'meet',
    scope: 'voskhod',
    table: 'questions',
    primary_key: '2',
    value: {
      id: '2',
      number: '2',
      coopname: 'voskhod',
      meet_id: testMeetId,
      title: 'Избрание совета кооператива',
      context: '',
      decision: 'Избрать новый состав совета кооператива',
      counter_votes_for: '1',
      counter_votes_against: '0',
      counter_votes_abstained: '0',
      voters_for: ['individual'],
      voters_against: [],
      voters_abstained: [],
    },
  })

  // Добавляем данные решения совета в таблицу decisions для тестирования документов 301 и 304
  await deltas.insertOne({
    block_num: 0,
    present: true,
    code: 'soviet',
    scope: 'voskhod',
    table: 'decisions',
    primary_key: '1',
    value: {
      id: '1',
      coopname: 'voskhod',
      type: 'general_meeting',
      title: 'О созыве очередного общего собрания пайщиков',
      description: 'Решение о созыве очередного общего собрания пайщиков кооператива ВОСХОД',
      statement: {
        version: '1.0.0',
        hash: 'statement_hash',
        doc_hash: 'statement_doc_hash',
        meta_hash: 'statement_meta_hash',
        meta: '{}',
        signatures: [],
      },
      decision: {
        version: '1.0.0',
        hash: 'decision_hash',
        doc_hash: 'decision_doc_hash',
        meta_hash: 'decision_meta_hash',
        meta: '{}',
        signatures: [],
      },
      batch_id: '0',
      expiration: '2024-12-31T23:59:59.000',
      created_at: '2024-12-15T00:00:00.000',
      created_by: 'ant',
      question_type: 'general_meeting',
      status: 'active',
    },
  })

  // Добавляем authorize actions для decisions (нужны для meet 301, market актов)
  for (const decId of ['1', '2', '5']) {
    await actions.insertOne({
      block_num: 0,
      account: 'soviet',
      name: 'authorize',
      receiver: 'soviet',
      data: {
        coopname: 'voskhod',
        decision_id: decId,
        chairman: 'ant',
        document: {
          version: '1.0.0',
          hash: `DECISION_${decId}_AUTH_HASH`,
          doc_hash: `DECISION_${decId}_AUTH_DOC_HASH`,
          meta_hash: `DECISION_${decId}_AUTH_META_HASH`,
          meta: JSON.stringify({
            title: `Протокол решения совета №${decId}`,
            registry_id: 301,
            lang: 'ru',
            generator: 'coopjs',
            version: '2025.1.1',
            coopname: 'voskhod',
            username: 'ant',
            created_at: '15.12.2024 12:00',
            block_num: 0,
            timezone: 'Europe/Moscow',
            links: [],
          }),
          signatures: [{
            id: 1,
            signed_hash: `DECISION_${decId}_SIGNED_HASH`,
            signer: 'ant',
            public_key: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
            signature: 'SIG_K1_test_signature',
            signed_at: '2024-12-15T12:00:00.000',
            meta: '{}',
          }],
        },
      },
    })
  }

  // Добавляем decision с accepted статусом для тестов 301/акты
  await deltas.insertOne({
    block_num: 0,
    present: true,
    code: 'soviet',
    scope: 'voskhod',
    table: 'decisions',
    primary_key: '2',
    value: {
      id: '2',
      coopname: 'voskhod',
      type: 'general_meeting',
      title: 'О созыве внеочередного общего собрания пайщиков',
      description: '',
      statement: { version: '1.0.0', hash: 'h', doc_hash: 'dh', meta_hash: 'mh', meta: '{}', signatures: [] },
      decision: { version: '1.0.0', hash: 'h2', doc_hash: 'dh2', meta_hash: 'mh2', meta: '{}', signatures: [] },
      batch_id: '0',
      expiration: '2026-12-31T23:59:59.000',
      created_at: '2024-12-15T00:00:00.000',
      created_by: 'ant',
      question_type: 'general_meeting',
      status: 'accepted',
    },
  })

  // Добавляем signatures для тестов заявлений на вступление (100)
  const signatures = storage.getCollection('signatures')
  for (const username of ['ant', 'individual', 'entrepreneur', 'exampleorg']) {
    await signatures.insertOne({
      username,
      block_num: 0,
      signature: 'SIG_K1_test_signature_placeholder',
    })
  }

  // Добавляем Udata записи для тестов capital/blagorost/generation
  const udataRecords = [
    { key: 'blagorost_contributor_contract_number', value: 'БК-001/2024' },
    { key: 'blagorost_contributor_contract_created_at', value: '2024-06-15T10:00:00.000Z' },
    { key: 'generator_agreement_number', value: 'ГС-001/2024' },
    { key: 'generator_agreement_created_at', value: '2024-06-15T10:00:00.000Z' },
    { key: 'blagorost_agreement_number', value: 'БЛ-001/2024' },
    { key: 'blagorost_agreement_created_at', value: '2024-06-15T10:00:00.000Z' },
    { key: 'blagorost_storage_agreement_number', value: 'ДХ-001/2024' },
    { key: 'blagorost_storage_agreement_created_at', value: '2024-06-15T10:00:00.000Z' },
  ]

  const udatas = storage.getCollection('udatas')
  for (const rec of udataRecords) {
    await udatas.insertOne({
      coopname: 'voskhod',
      username: 'ant',
      key: rec.key,
      value: rec.value,
      deleted: false,
      block_num: 0,
    })
  }

  await storage.disconnect()
  await generator.disconnect()
}
