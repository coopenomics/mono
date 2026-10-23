import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1020

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  appendix_hash: string
  appendix_created_at: string
  project_hash: string
  amount: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  appendix_hash: string
  short_appendix_hash: string
  contributor_contract_number: string
  contributor_contract_created_at: string
  appendix_created_at: string
  project_hash: string
  amount: string
  blagorost_agreement_number: string
  blagorost_agreement_created_at: string
}

export const title = 'Заявление об инвестировании денежных средств в Благорост'
export const description = 'Заявление о зачете части паевого взноса в качестве инвестиции'

export const context = `<div class="digital-document"><p style="text-align: right">{% trans 'council_of' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p style="text-align: right">{% trans 'from_shareholder' %} {{ common_user.full_name_or_short_name }}</p><div style="text-align: center"><h1>{% trans 'statement' %}</h1></div><p>{% trans 'in_accordance_with_agreement' %} №{{ blagorost_agreement_number }} {% trans 'from_date' %} {{ blagorost_agreement_created_at }} {% trans 'my_participation_text' %} {% trans 'and_appendix' %} №{{ short_appendix_hash }} {% trans 'from_date' %} {{ appendix_created_at }} {% trans 'to_contract' %} {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }}, {% trans 'request_to_credit' %} {% trans 'target_share_contribution' %} {% trans 'target_consumer_program' %} "{% trans 'digital_wallet' %}" {% trans 'in_amount' %} {{ amount }} {% trans 'to_blagorost_program' %} {% trans 'with_priority_direction' %} {% trans 'digital_wallet_project' %} №{{ project_hash }}.</p><p style="text-align: right">{{ created_at }}</p><p style="text-align: right">{% trans 'signed_by_digital_signature' %}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}</style>`

export const translations = {
  ru: {
    council_of: 'В Совет',
    from_shareholder: 'От пайщика',
    statement: 'ЗАЯВЛЕНИЕ',
    in_accordance_with_agreement: 'В соответствии с условиями Соглашения',
    my_participation_text: 'моего участия в целевой потребительской программе "БЛАГОРОСТ"',
    and_appendix: 'и Приложения',
    from_date: 'от',
    to_contract: 'к Договору об участии в хозяйственной деятельности №',
    request_to_credit: 'прошу зачесть часть моего',
    target_share_contribution: 'целевого паевого взноса',
    target_consumer_program: 'по Целевой Потребительской Программе',
    digital_wallet: 'ЦИФРОВОЙ КОШЕЛЕК',
    in_amount: 'в размере',
    to_blagorost_program: 'в целевую потребительскую программу "БЛАГОРОСТ"',
    with_priority_direction: 'с приоритетным направлением на цифровой кошелек',
    digital_wallet_project: 'Проекта',
    signed_by_digital_signature: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '15.01.2026 14:30',
  },
  appendix_hash: 'A001INV1',
  short_appendix_hash: 'A001INV1',
  contributor_contract_number: 'INV123456789',
  contributor_contract_created_at: '10.01.2026',
  appendix_created_at: '12.01.2026',
  project_hash: 'PRJ20260115001',
  amount: '50000.00 RUB',
  blagorost_agreement_number: 'ed3bcfd5b681aa83d',
  blagorost_agreement_created_at: '11.04.2024',
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    phone: '+7 999 123-45-67',
    email: 'ivanov@example.com',
  },
  coop: {
    city: 'Москва',
  },
}
