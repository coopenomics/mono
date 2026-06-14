import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'
import type { IIndividualData } from '../../users'

export const registry_id = 329

/**
 * Интерфейс генерации доверенности, выдаваемой кооперативом председателю
 * кооперативного участка. Доверитель — кооператив в лице Председателя Совета
 * (накладывает встречную подпись после решения совета об учреждении участка);
 * уполномоченный («Гражданин») — избранный председатель кооперативного участка
 * (trustee), подписывающий доверенность вместе с договором о материальной
 * ответственности при подаче заявления. Документ подписывается двумя сторонами:
 * сначала председателем участка, затем встречной подписью председателя совета.
 */
export interface Action extends IGenerate {
  hash: string
  branch_name: string
  branch_address: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  individual: IIndividualData
  branch_name: string
  branch_address: string
  vars: IVars
}

export const title = 'Доверенность председателю кооперативного участка'
export const description = 'Форма доверенности, выдаваемой кооперативом в лице Председателя Совета избранному председателю кооперативного участка на право представлять участок и распоряжаться его средствами'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;font-size: 16px;}.digital-document {padding: 20px;white-space: pre-wrap;}.digital-document p {margin: 0px;padding-top: 10px;text-align: justify;}.requisites p {padding-top: 2px;}.signature {padding-top: 20px;}</style><div class="digital-document"><h1 class="header">{% trans 'POA_TITLE' %}</h1><p style="text-align: right; padding-top: 20px;">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'PREAMBLE', vars.full_abbr, vars.name, coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, individual.last_name, individual.first_name, individual.middle_name, branch_name, vars.full_abbr, vars.name, branch_address, vars.full_abbr, vars.name, vars.full_abbr, vars.name %}</p><p>{% trans 'BANK_ACCOUNTS', individual.last_name, individual.first_name, individual.middle_name, vars.full_abbr, vars.name %}</p><p>{% trans 'RESPONSIBILITY', individual.last_name, individual.first_name, individual.middle_name, vars.full_abbr, vars.name %}</p><p>{% trans 'SIGNATURE_CERTIFIED', individual.last_name, individual.first_name, individual.middle_name %}</p><p>{% trans 'NON_TRANSFERABLE' %}</p><p>{% trans 'TERM_ONE_YEAR' %}</p><div class="requisites" style="padding-top: 30px;"><p><strong>{% trans 'PRINCIPAL_LABEL' %} {{ vars.full_abbr }} «{{ vars.name }}»</strong></p><p>{% trans 'INN' %} {{ coop.details.inn }}</p><p>{% trans 'KPP' %} {{ coop.details.kpp }}</p><p>{% trans 'OGRN' %} {{ coop.details.ogrn }}</p><p>{% trans 'LEGAL_ADDRESS' %} {{ coop.full_address }}</p><p>{% trans 'COUNCIL_CHAIRMAN_LABEL' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div><div class="requisites" style="padding-top: 20px;"><p><strong>{% trans 'AUTHORIZED_LABEL' %} {{ individual.last_name }} {{ individual.first_name }} {{ individual.middle_name }}</strong></p>{% if individual.passport %}<p>{% trans 'PASSPORT_SERIES_NUMBER', individual.passport.series, individual.passport.number %}</p><p>{% trans 'PASSPORT_ISSUED', individual.passport.issued_by, individual.passport.code %}</p><p>{% trans 'PASSPORT_ISSUED_AT', individual.passport.issued_at %}</p>{% endif %}<p>{% trans 'REGISTRATION_ADDRESS' %} {{ individual.full_address }}</p><p>{% trans 'CONTACT_PHONE' %} {{ individual.phone }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    POA_TITLE: 'ДОВЕРЕННОСТЬ',
    PREAMBLE: '{0} «{1}» в лице Председателя Совета {2} {3} {4}, действующего на основании Устава, настоящей доверенностью уполномочивает гражданина {5} {6} {7} действовать в лице Председателя Кооперативного участка «{8}» {9} «{10}», расположенного по адресу: {11} (далее — КУ), в соответствии с законодательством Российской Федерации и Уставом {12} «{13}», и представлять КУ в отношениях с другими юридическими лицами и гражданами, распоряжаться денежными средствами КУ в соответствии с Положением о кооперативном участке, утверждённым решением Собрания Совета {14} «{15}», вести переговоры, подготавливать документы, заключать договоры с правом подписи по сделкам КУ, а также совершать иные действия, связанные с выполнением настоящего поручения.',
    BANK_ACCOUNTS: 'Также гражданин {0} {1} {2} имеет право распоряжения и управления открытыми {3} «{4}» для КУ банковскими счетами.',
    RESPONSIBILITY: 'Гражданин {0} {1} {2} несёт ответственность за все свои действия и деловые операции, осуществляемые в интересах {3} «{4}».',
    SIGNATURE_CERTIFIED: 'Подпись гражданина {0} {1} {2} удостоверяю.',
    NON_TRANSFERABLE: 'Полномочия по настоящей доверенности не могут быть переданы другим лицам.',
    TERM_ONE_YEAR: 'Доверенность выдана на срок один год.',
    INN: 'ИНН',
    KPP: 'КПП',
    OGRN: 'ОГРН',
    LEGAL_ADDRESS: 'Юридический адрес:',
    PRINCIPAL_LABEL: 'Доверитель: Потребительский кооператив',
    COUNCIL_CHAIRMAN_LABEL: 'Председатель Совета:',
    AUTHORIZED_LABEL: 'Уполномоченный (председатель участка): ФИО (полностью)',
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
    chairman: {
      last_name: 'Петров',
      first_name: 'Пётр',
      middle_name: 'Петрович',
    },
  },
  meta: {
    created_at: '20.03.2024 12:00',
  },
  individual: {
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
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
  branch_address: 'г. Москва, ул. Кооперативная, д. 5',
  vars: {
    full_abbr: 'Потребительский кооператив',
    name: 'ВОСХОД',
    passport_request: 'yes',
  },
}
