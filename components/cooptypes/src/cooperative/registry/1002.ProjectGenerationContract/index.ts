import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1002

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  appendix_hash: string
  project_name: string
  project_hash: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  appendix_hash: string
  short_appendix_hash: string
  contributor_contract_number: string
  contributor_contract_created_at: string
  project_name: string
  project_hash: string
  generator_agreement_number: string
  generator_agreement_created_at: string
}

export const title = 'Приложение к договору участия в проекте'
export const description = 'Приложение к договору участия в хозяйственной деятельности для проектов'

export const context = `<div class="digital-document"><div style="text-align: center"><h1>ПРИЛОЖЕНИЕ № {{ short_appendix_hash }}</h1><h2>к Договору об участии в хозяйственной деятельности № {{ contributor_contract_number }}</h2></div><p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p><p>{% trans 'parties_intro' %} "{{ vars.name }}" {% trans 'in_face_of_chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}, {% trans 'acting_on_basis_of_charter' %}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'society' %}", {% trans 'and_participant' %} {{ user.full_name_or_short_name }}, {% trans 'hereinafter_referred_to_as' %} "{% trans 'participant' %}", {% trans 'jointly_referred_to_as' %} "{% trans 'parties' %}", {% trans 'have_concluded_this_appendix' %} {% trans 'hereinafter_referred_to_as' %} "{% trans 'appendix' %}" {% trans 'to_agreement' %} {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }} {% trans 'of_the_following' %}:</p><p>{% trans 'according_to_regulations' %} "{{ generator_agreement_number }}" {% trans 'from_date' %} {{ generator_agreement_created_at }}), {% trans 'participant_commits_project' %} "{{ project_name }}" (№{{ project_hash }}).</p><h2>{% trans 'details_and_signatures_of_parties' %}</h2><p><strong>{% trans 'society' %}/{{ vars.full_abbr }} "{{ vars.name }}"/:</strong></p><p>ИНН {{ coop.details.inn }}, КПП {{ coop.details.kpp }}, ОГРН {{ coop.details.ogrn }}</p><p>{% trans 'legal_address' %}: {{ coop.full_address }}</p><p>{% trans 'contact_phone' %}: {{ coop.phone }}</p><p>{% trans 'email' %}: {{ coop.email }}</p><p>{% trans 'bank_account' %}: {{ coop.defaultBankAccount.account_number }}</p><p>{% trans 'bank_name' %}: {{ coop.defaultBankAccount.bank_name }}</p><p>{% trans 'bik' %}: {{ coop.defaultBankAccount.details.bik }}</p><p>{% trans 'correspondent_account' %}: {{ coop.defaultBankAccount.details.corr }}</p><p>{% trans 'chairman' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p><p><strong>{% trans 'participant' %}:</strong></p><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'contact_phone' %}: {{ user.phone }}</p><p>{% trans 'email' %}: {{ user.email }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    parties_intro: 'Потребительский Кооператив',
    in_face_of_chairman: 'в лице Председателя Совета',
    acting_on_basis_of_charter: 'действующего на основании Устава',
    hereinafter_referred_to_as: 'далее именуемый(-ая)',
    society: 'Общество',
    and_participant: 'и',
    participant: 'Пайщик',
    jointly_referred_to_as: 'совместно именуемые',
    parties: 'Стороны',
    have_concluded_this_appendix: 'составили настоящее Приложение',
    appendix: 'Приложение',
    to_agreement: 'к Договору об участии в хозяйственной деятельности №',
    from_date: 'от',
    of_the_following: 'о нижеследующем',
    according_to_regulations: 'В соответствии с условиями Пользовательского Соглашения по присоединению пайщиков Потребительского Кооператива "ВОСХОД" к целевой потребительской программе "ГЕНЕРАТОР" №',
    participant_commits_project: 'Пайщик принимает на себя обязательства связанные с участием в реализации Проекта',
    details_and_signatures_of_parties: 'РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
    legal_address: 'Юр. адрес',
    contact_phone: 'Контактный тел.',
    email: 'Электронная почта',
    bank_account: 'Р/с',
    bank_name: 'Банк',
    bik: 'БИК',
    correspondent_account: 'Корр/счет',
    chairman: 'Председатель Совета',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  appendix_hash: 'A001ZSA1',
  short_appendix_hash: 'A001ZSA1',
  contributor_contract_number: 'ED3BCFC5B681AA83D',
  contributor_contract_created_at: '11.04.2024',
  project_name: 'Проект цифровой платформы',
  project_hash: 'B2C3D4E5F6789ABC',
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr: 'Потребительский Кооператив',
  },
  generator_agreement_number: 'ГЕН-11-04-24',
  generator_agreement_created_at: '11 апреля 2024 г.',
  user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    abbr_full_name: 'Иванов И.И.',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
    details: {
      inn: '9728130611',
      kpp: '772801001',
      ogrn: '1247700283346',
    },
    full_address: '117593, г. МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ ЯСЕНЕВО, ПРОЕЗД СОЛОВЬИНЫЙ, Д. 1, ПОМЕЩ. 1/1',
    phone: '+7 900 000-00-01',
    email: 'chairman@example.com',
    defaultBankAccount: {
      currency: 'RUB',
      bank_name: 'ПАО Сбербанк',
      account_number: '40703810038000110117',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
    city: 'Москва',
  },
}
