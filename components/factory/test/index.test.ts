import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { ExternalOrganizationData, ExternalProjectData, IVars } from '../src/Models'
import type { PaymentData } from '../src/Models/PaymentMethod'
import type { CoopenomicsAgreement } from '../src/Templates'
import { PrivacyPolicy, RegulationElectronicSignature, UserAgreement, WalletAgreement } from '../src/Templates'
import { signatureExample } from './signatureExample'
import { coopname, generator, mongoUri } from './utils'
import { testDocumentGeneration } from './utils/testDocument'

beforeAll(async () => {
  await generator.connect(mongoUri)
})

beforeEach(async () => {

})

describe('тест генератора документов', async () => {
  it('сохранение, извлечение и удаление банковских реквизитов пользователя', async () => {
    const paymentData: PaymentData = {
      username: 'ant',
      method_id: '1',
      method_type: 'sbp',
      is_default: true,
      data: {
        phone: '+7-111-111-111-11',
      },
      deleted: false,
    }

    const saved = await generator.save('paymentMethod', paymentData)
    const paymentMethod = await generator.get('paymentMethod', { username: 'ant', method_id: paymentData.method_id }) as any
    expect(paymentMethod.deleted).toEqual(false)

    Object.keys(paymentData).forEach((field) => {
      expect(paymentMethod[field]).toBeDefined()
    })

    expect(paymentMethod._id).toEqual(saved.insertedId)

    const paymentList = await generator.list('paymentMethod', { username: 'ant', method_id: paymentData.method_id })

    expect(paymentList.limit).toBeDefined()
    expect(paymentList.results).toBeDefined()
    expect(paymentList.totalPages).toBeDefined()
    expect(paymentList.totalResults).toBeDefined()

    expect(paymentList.results.length).toEqual(1)

    await generator.del('paymentMethod', { username: 'ant', method_id: paymentData.method_id })

    const updatedPaymentMethod = await generator.get('paymentMethod', { username: 'ant', method_id: paymentData.method_id }) as any

    expect(updatedPaymentMethod.deleted).toEqual(true)
  })

  it('синтезируем сборку модели кооператива', async () => {
    const cooperative = await generator.constructCooperative(coopname)
    expect(cooperative).toBeDefined()

    if (cooperative) {
      expect(cooperative.username).toEqual('voskhod')
      expect(cooperative.is_cooperative).toEqual(true)
      expect(cooperative.members.length).toEqual(cooperative.totalMembers)
    }
  })

  it('сохранение и извлечение данных проекта решения', async () => {
    const projectData: ExternalProjectData = {
      id: '123',
      question: 'Предлагается решить то да сё и вот это ещё. ',
      decision: 'Решили! Делаем вот то и еще вот это.',
    }

    const saved = await generator.save('project', projectData)

    const retrivedData = await generator.get('project', { id: projectData.id }) as any

    Object.keys(projectData).forEach((field) => {
      expect(retrivedData[field]).toBeDefined()
    })

    expect(retrivedData._id).toEqual(saved.insertedId)
  })

  it('генерируем проект свободного решения', async () => {
    await testDocumentGeneration({
      registry_id: 599,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      project_id: '123',
    })
  })

  it('генерируем свободное решение', async () => {
    await testDocumentGeneration({
      registry_id: 600,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      project_id: '123',
      decision_id: 5,
    })
  })

  it('генерируем заявление на вступление физического лица', async () => {
    await testDocumentGeneration({
      registry_id: 100,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })

    await testDocumentGeneration({
      registry_id: 501,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      decision_id: 2,
    })
  })

  it('генерируем заявление на присоединение к ЦПП "Цифровой Кошелёк"', async () => {
    const params: WalletAgreement.Action = {
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      registry_id: WalletAgreement.registry_id,
      protocol_number: '01-01-2024',
      protocol_day_month_year: '1 января 2024 г.',
    }
    await testDocumentGeneration(params)
  })

  it('генерируем согласие с правилами ЭЦП', async () => {
    const params: RegulationElectronicSignature.Action = {
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      registry_id: RegulationElectronicSignature.registry_id,
      protocol_number: '01-01-2024',
      protocol_day_month_year: '1 января 2024 г.',
    }
    await testDocumentGeneration(params)
  })

  it('генерируем согласие с политикой конфиденциальности', async () => {
    const params: PrivacyPolicy.Action = {
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      registry_id: PrivacyPolicy.registry_id,
      protocol_number: '01-01-2024',
      protocol_day_month_year: '1 января 2024 г.',
    }
    await testDocumentGeneration(params)
  })

  it('генерируем согласие с пользовательским соглашением', async () => {
    const params: UserAgreement.Action = {
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      registry_id: UserAgreement.registry_id,
      protocol_number: '01-01-2024',
      protocol_day_month_year: '1 января 2024 г.',
    }
    await testDocumentGeneration(params)
  })

  it('генерируем заявление на вступление юридического лица', async () => {
    await testDocumentGeneration({
      registry_id: 100,
      coopname: 'voskhod',
      username: 'exampleorg',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })

    await testDocumentGeneration({
      registry_id: 501,
      coopname: 'voskhod',
      username: 'exampleorg',
      lang: 'ru',
      decision_id: 3,
    })
  })

  it('генерируем заявление на вступление индивидуального предпринимателя', async () => {
    await testDocumentGeneration({
      registry_id: 100,
      coopname: 'voskhod',
      username: 'entrepreneur',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })

    await testDocumentGeneration({
      registry_id: 501,
      coopname: 'voskhod',
      username: 'entrepreneur',
      lang: 'ru',
      decision_id: 4,
    })
  })

  it('генерируем заявление на выход физического лица', async () => {
    await testDocumentGeneration({
      registry_id: 200,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })

    await testDocumentGeneration({
      registry_id: 201,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      decision_id: 5,
    })
  })

  it('генерируем заявление на выход юридического лица', async () => {
    await testDocumentGeneration({
      registry_id: 200,
      coopname: 'voskhod',
      username: 'exampleorg',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })
  })

  it('генерируем заявление на выход индивидуального предпринимателя', async () => {
    await testDocumentGeneration({
      registry_id: 200,
      coopname: 'voskhod',
      username: 'entrepreneur',
      lang: 'ru',
      block_num: 1,
      signature: signatureExample,
    })
  })

  it('генерируем соглашение на подключение', async () => {
    const voskhodData: ExternalOrganizationData = {
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

    await generator.save('organization', voskhodData)

    const vars: IVars = {
      coopname: 'voskhod',
      full_abbr: 'Потребительский Кооператив',
      full_abbr_genitive: 'Потребительского Кооператива',
      full_abbr_dative: 'Потребительскому Кооперативу',
      short_abbr: 'ПК',
      website: 'цифровой-кооператив.рф',
      name: 'Восход',
      confidential_link: 'coopenomics.world/privacy',
      confidential_email: 'privacy@coopenomics.world',
      contact_email: 'contact@coopenomics.world',
      passport_request: 'no',
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
      coopenomics_agreement: {
        protocol_number: '10-04-2024',
        protocol_day_month_year: '10 апреля 2024 г.',
      },
    }

    await generator.save('vars', vars)

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

    const coopname = 'test'

    const organizationData: ExternalOrganizationData = {
      username: coopname,
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

    await generator.save('organization', organizationData)

    const paymentData2: PaymentData = {
      username: coopname,
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

    await generator.save('paymentMethod', paymentData2)

    const act: CoopenomicsAgreement.Action = {
      registry_id: 50,
      coopname: 'voskhod',
      username: 'test',
      lang: 'ru',
    }

    await testDocumentGeneration(act)
  })

  it('генерируем заявление о конвертации паевого взноса в членский взнос', async () => {
    await testDocumentGeneration({
      registry_id: 51,
      coopname: 'voskhod',
      username: 'ant',
      lang: 'ru',
      convert_amount: '1500.00 RUB',
    })
  })

  it('генерируем заявление на выбор кооперативного участка физлицом', async () => {
    await testDocumentGeneration({
      registry_id: 101,
      coopname: 'voskhod',
      username: 'ant',
      braname: 'branch',
    })
  })

  it('генерируем заявление на выбор кооперативного участка юрлицом', async () => {
    await testDocumentGeneration({
      registry_id: 101,
      coopname: 'voskhod',
      username: 'exampleorg',
      braname: 'branch',
    })
  })

  it('генерируем заявление на выбор кооперативного участка предпринимателем', async () => {
    await testDocumentGeneration({
      registry_id: 101,
      coopname: 'voskhod',
      username: 'entrepreneur',
      braname: 'branch',
    })
  })
})
