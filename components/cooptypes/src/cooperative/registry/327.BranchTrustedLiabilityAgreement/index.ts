import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IIndividualData } from '../../users'

export const registry_id = 327

/**
 * Интерфейс генерации договора о полной индивидуальной материальной
 * ответственности доверенного лица кооперативного участка. Текст полностью
 * повторяет договор председателя участка (328), отличаются только стороны:
 * «Исполнитель» — доверенное лицо (пайщик), за которое отвечает участок;
 * «Общество» представляет не Председатель Совета, а Председатель кооперативного
 * участка (trustee), который и накладывает встречную подпись при одобрении
 * заявки доверенного. Документ подписывается двумя сторонами: сначала доверенным
 * лицом при подаче заявки, затем встречной подписью председателя участка.
 */
export interface Action extends IGenerate {
  hash: string
  branch_name: string
  // username председателя участка; ФИО резолвит фабрика через getUser,
  // в meta (→ on-chain) уходит только username
  trustee: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  individual: IIndividualData
  branch_name: string
  trustee_full_name: string
  vars: IVars
}

export const title = 'Договор о полной индивидуальной материальной ответственности доверенного лица кооперативного участка'
export const description = 'Форма договора о полной индивидуальной материальной ответственности доверенного лица кооперативного участка между кооперативом в лице Председателя кооперативного участка и доверенным лицом'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;font-size: 16px;}.digital-document {padding: 20px;white-space: pre-wrap;}.digital-document p {margin: 0px;padding-top: 10px;text-align: justify;}.requisites p {padding-top: 2px;}.signature {padding-top: 20px;}</style><div class="digital-document"><h1 class="header">{% trans 'AGREEMENT_TITLE' %}</h1><p style="text-align: right; padding-top: 20px;">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'PREAMBLE', vars.full_abbr, vars.name, branch_name, trustee_full_name, branch_name, vars.full_abbr, vars.name %}</p><p>{% trans 'CLAUSE_1' %}</p><p>{% trans 'CLAUSE_1_A' %}</p><p>{% trans 'CLAUSE_1_B' %}</p><p>{% trans 'CLAUSE_1_C' %}</p><p>{% trans 'CLAUSE_1_D' %}</p><p>{% trans 'CLAUSE_2' %}</p><p>{% trans 'CLAUSE_2_A' %}</p><p>{% trans 'CLAUSE_2_B' %}</p><p>{% trans 'CLAUSE_2_REVISION' %}</p><p>{% trans 'CLAUSE_3' %}</p><p>{% trans 'CLAUSE_3_PARA2' %}</p><p>{% trans 'CLAUSE_4' %}</p><p>{% trans 'CLAUSE_5' %}</p><p>{% trans 'COPIES' %}</p><div class="requisites" style="padding-top: 30px;"><p><strong>{% trans 'SOCIETY_LABEL' %} {{ vars.full_abbr }} «{{ vars.name }}»</strong></p><p>{% trans 'INN' %} {{ coop.details.inn }}</p><p>{% trans 'KPP' %} {{ coop.details.kpp }}</p><p>{% trans 'OGRN' %} {{ coop.details.ogrn }}</p><p>{% trans 'LEGAL_ADDRESS' %} {{ coop.full_address }}</p><p>{% trans 'BRANCH_CHAIRMAN_LABEL' %} {{ trustee_full_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div><div class="requisites" style="padding-top: 20px;"><p><strong>{% trans 'EXECUTOR_LABEL' %} {{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}</strong></p>{% if individual.passport %}<p>{% trans 'PASSPORT_SERIES_NUMBER', individual.passport.series, individual.passport.number %}</p><p>{% trans 'PASSPORT_ISSUED', individual.passport.issued_by, individual.passport.code %}</p><p>{% trans 'PASSPORT_ISSUED_AT', individual.passport.issued_at %}</p>{% endif %}<p>{% trans 'REGISTRATION_ADDRESS' %} {{ individual.full_address }}</p><p>{% trans 'CONTACT_PHONE' %} {{ individual.phone }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    AGREEMENT_TITLE: 'ДОГОВОР О ПОЛНОЙ ИНДИВИДУАЛЬНОЙ МАТЕРИАЛЬНОЙ ОТВЕТСТВЕННОСТИ',
    PREAMBLE: 'В целях обеспечения сохранности материальных ценностей, {0} «{1}», в лице Председателя Кооперативного участка «{2}» {3}, действующего на основании Устава, именуемое в дальнейшем «Общество», и доверенное лицо Кооперативного участка «{4}» {5} «{6}», именуемое в дальнейшем «Исполнитель», заключили настоящий договор о нижеследующем:',
    CLAUSE_1: '1. Исполнитель, выполняющий работу бухгалтера-кассира, непосредственно связанную с пересчетом, обработкой, приемом, выдачей, хранением, перевозкой денежных средств, других ценностей и имущества, принимает на себя полную материальную ответственность за обеспечение сохранности вверенных ему денежных средств, имущества и других ценностей и обязуется:',
    CLAUSE_1_A: '— бережно относиться к вверенным ему ценностям и имуществу и принимать меры к предотвращению ущерба;',
    CLAUSE_1_B: '— своевременно сообщать Обществу о всех обстоятельствах, угрожающих обеспечению сохранности вверенных Исполнителю денежных средств, имущества и других ценностей;',
    CLAUSE_1_C: '— строго соблюдать установленные правила совершения операций с денежными средствами, имуществом и другими ценностями, а также их хранения;',
    CLAUSE_1_D: '— не допускать разглашения сведений об известных ему операциях с денежными средствами, имуществом и другими ценностями по их хранению, отправке, перевозке, охране, сигнализации, а также о связанных с ними служебных поручениях.',
    CLAUSE_2: '2. Общество обязуется:',
    CLAUSE_2_A: '— создать Исполнителю условия, необходимые для нормальной работы и обеспечения полной сохранности вверенных ему денежных средств, имущества и других ценностей;',
    CLAUSE_2_B: '— ознакомить Исполнителя с действующим законодательством о материальной ответственности за ущерб, причиненный Обществу, а также с инструкциями и правилами хранения, приема, выдачи, обработки, пересчета и перевозки денежных средств, имущества и других ценностей Общества.',
    CLAUSE_2_REVISION: 'Общество проводит в установленном порядке ревизии денежных средств, имущества и других ценностей и проверки соблюдения правил совершения операций с ними.',
    CLAUSE_3: '3. Исполнитель несет материальную ответственность за сохранность денежных средств, имущества и других ценностей и за всякий ущерб, причиненный Обществу, как в результате умышленных действий, так и в результате небрежного или недобросовестного отношения к своим обязанностям, с момента фактического приема им денежных средств, имущества и других ценностей.',
    CLAUSE_3_PARA2: 'Исполнитель несет материальную ответственность независимо от того, когда обнаружены оформленные соответствующими документами (актами) недостачи денежных средств, имущества и других ценностей, и иные недостатки в работе, причинившие материальный ущерб Обществу. Определение размера ущерба и его возмещение производится в соответствии с действующим законодательством.',
    CLAUSE_4: '4. Исполнитель освобождается от материальной ответственности, если ущерб причинен не по его вине.',
    CLAUSE_5: '5. Действие настоящего договора распространяется на весь период работы с вверенными Исполнителю денежными средствами, имуществом и другими ценностями.',
    COPIES: 'Настоящий договор составлен в двух экземплярах: первый экземпляр — Обществу, второй экземпляр — Исполнителю.',
    SOCIETY_LABEL: 'Общество: Потребительский кооператив',
    INN: 'ИНН',
    KPP: 'КПП',
    OGRN: 'ОГРН',
    LEGAL_ADDRESS: 'Юридический адрес:',
    BRANCH_CHAIRMAN_LABEL: 'Председатель Кооперативного участка:',
    EXECUTOR_LABEL: 'Исполнитель (доверенное лицо): ФИО (полностью)',
    PASSPORT_SERIES_NUMBER: 'Паспорт серии: {0} № {1}',
    PASSPORT_ISSUED: 'Выдан: {0}, к/п {1}',
    PASSPORT_ISSUED_AT: 'Дата выдачи: {0}',
    REGISTRATION_ADDRESS: 'Адрес регистрации:',
    CONTACT_PHONE: 'Контактный телефон:',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Ленина, д. 1',
    details: {
      inn: '7712345678',
      kpp: '771201001',
      ogrn: '1234567890123',
    },
  },
  meta: {
    created_at: '20.03.2024 12:00',
  },
  individual: {
    last_name: 'Сидоров',
    first_name: 'Иван',
    middle_name: 'Петрович',
    full_address: 'г. Москва, ул. Советская, д. 3, кв. 84',
    phone: '+79001234567',
    passport: {
      series: '7712',
      number: '122112',
      issued_by: 'отделом УФМС России по г. Москве',
      issued_at: '10.05.2010',
      code: '220-220',
    },
  },
  branch_name: 'РОМАШКА',
  trustee_full_name: 'Иванов Петр Сидорович',
  vars: {
    full_abbr: 'Потребительский кооператив',
    name: 'ВОСХОД',
    passport_request: 'yes',
  },
}
