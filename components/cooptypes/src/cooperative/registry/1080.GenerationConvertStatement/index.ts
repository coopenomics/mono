import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1080

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  appendix_hash: string
  project_hash: string
  main_wallet_amount: string
  blagorost_wallet_amount: string
  to_wallet: boolean
  to_blagorost: boolean
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  contributor_contract_number: string
  contributor_contract_created_at: string
  appendix_hash: string
  appendix_short_hash: string
  project_hash: string
  project_short_hash: string
  main_wallet_amount: string
  blagorost_wallet_amount: string
  to_wallet: boolean
  to_blagorost: boolean
}

export const title = 'Заявление о трансляции паевого взноса из программы "Генерация"'
export const description = 'Форма заявления о трансляции паевого взноса из программы "Генерация" в Цифровой Кошелёк и/или в программу «Благорост»'

export const context = `<div class="digital-document"><div style="text-align: right"><p>{% trans 'to_council' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{% trans 'from_shareholder' %} {{ common_user.full_name_or_short_name }}</p></div><div style="text-align: center"><h2>{% trans 'statement_title' %}</h2><h3>{% trans 'statement_subtitle' %}</h3></div><p>{% trans 'statement_text' %} № {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }} {% trans 'and_appendix' %} № {{ appendix_short_hash }}, {% trans 'request_text' %} №{{ project_short_hash }} {% trans 'following_way' %}:</p><ol>{% if to_wallet %}<li>{% trans 'wallet_conversion_text', main_wallet_amount %}</li>{% endif %}{% if to_blagorost %}<li>{% trans 'blagorost_conversion_text', blagorost_wallet_amount %}</li>{% endif %}</ol><div style="margin-top: 40px;"><p>{% trans 'signed_by_digital_signature' %}</p><p style="text-align: right">{{ meta.created_at }}</p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    to_council: 'В Совет',
    from_shareholder: 'От пайщика:',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subtitle: 'о переводе части целевого паевого взноса',
    statement_text: 'В соответствии с условиями Договора об участии в хозяйственной деятельности',
    from_date: 'от',
    and_appendix: 'и его Приложением',
    request_text: 'прошу осуществить перевод части моего целевого паевого взноса, аллоцированного в Проект',
    following_way: 'следующим образом',
    wallet_conversion_text: 'Перевести сумму в размере {0} на мой цифровой кошелек в Целевой Потребительской Программе «Цифровой Кошелек».',
    blagorost_conversion_text: 'Перевести сумму в размере {0} рублей в Целевую Потребительскую Программу «Благорост».',
    signed_by_digital_signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  contributor_contract_number: 'ED3BCFC5B681AA83D',
  contributor_contract_created_at: '11.04.2024',
  appendix_hash: 'APP1234567890ABCDEF',
  appendix_short_hash: 'APP1234567890ABCDEF',
  project_hash: 'PRJ1234567890ABCDEF',
  project_short_hash: 'PRJ1234567890ABCDEF',
  main_wallet_amount: '15000.00 RUB',
  blagorost_wallet_amount: '25000.00 RUB',
  to_wallet: true,
  to_blagorost: true,
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
    short_abbr: 'ПК',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
    city: 'Москва',
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
  },
}
