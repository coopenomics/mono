import type { IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 2010

export type ExpenseItemRecipientType = 'SELF' | 'MEMBER' | 'ORG'
export type ExpenseItemPaymentMechanics = 'ADVANCE' | 'DIRECT'

/**
 * Публичная часть позиции расхода — единственное, что публикуется в meta
 * документа on-chain. Реквизиты получателя, его имя и назначение платежа
 * сюда НЕ входят — они приватны (см. {@link IExpensePrivateItem}).
 */
export interface IExpenseItem {
  number: string
  description: string
  amount: string
  recipient_type: ExpenseItemRecipientType
  mechanics: ExpenseItemPaymentMechanics
}

/**
 * Приватная часть позиции — НЕ публикуется в блокчейн. Имя получателя,
 * его банковские реквизиты и назначение платежа сохраняются off-chain в
 * `doc_private_data` фабрики; в meta документа едет только `doc_data_hash`.
 * Корреляция с публичной позицией — по `number`.
 */
export interface IExpensePrivateItem {
  number: string
  recipient_name?: string
  requisites?: string
  /** Назначение платежа — отдельной строкой после реквизитов (для оплаты по счёту) */
  payment_purpose?: string
}

/**
 * Приватный payload СЗ-сметы целиком (off-chain). Сохраняется в
 * `DocDataService` фабрики, адресуется публичным `doc_data_hash`.
 * См. раздел «Document Generation Pattern: doc_data» в архитектуре.
 */
export interface PrivateData {
  items: IExpensePrivateItem[]
}

/**
 * Позиция в модели рендера — публичная + приватная части, склеенные фабрикой
 * по `number` при генерации документа. Шаблон обращается к полям как `item.*`.
 */
export interface IExpenseRenderItem extends IExpenseItem {
  recipient_name?: string
  requisites?: string
  payment_purpose?: string
}

export interface IExpenseProposalHeader {
  description: string
  total_amount: string
  items_count: number
  source_wallet: string
  /** Срок исполнения («в срок до»), формат DD.MM.YYYY — передаётся при создании расхода */
  deadline?: string
  /** Фонд списания в дательном падеже («по …») — подставляет сервер из параметров шасси расходов */
  fund_name?: string
}

export interface Action extends IGenerate, IDocDataRef {
  proposal_hash: string
  proposal: IExpenseProposalHeader
  /** Публичные позиции расхода — без реквизитов/имени/назначения (они в doc_data). */
  items: IExpenseItem[]
  /** sha256 приватного payload (PrivateData) — реквизиты/имя/назначение off-chain. */
  doc_data_hash: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  vars: IVars
  proposal_hash: string
  /** Короткий идентификатор СЗ (первые 16 символов хэша, uppercase) — для шапки документа */
  proposal_short_hash: string
  proposal: IExpenseProposalHeader
  /** Позиции с подмешанной приватной частью (фабрика склеивает по number из doc_data). */
  items: IExpenseRenderItem[]
}

export const title = 'Служебная записка-смета о расходах'
export const description = 'Заявка-смета председателю кооператива на финансирование расходов по программе. Содержит описание цели и массив позиций расхода.'

// Вёрстка по канону документов реестра (см. 1040): без <style>-блока — превью
// его не применяет; только inline text-align на div-обёртках. Шапка-адресат
// справа, центрированный заголовок с идентификатором (= proposal_hash, по нему
// записку можно найти), позиции — нумерованным списком: описание и сумма,
// затем построчно получатель, реквизиты и назначение платежа (для кассира).
// Кошелёк-источник в документе не указывается.
export const context = `<div class="digital-document"><div style="text-align: right"><p>{% trans 'TO_COUNCIL' %} {{vars.full_abbr_genitive}} «{{vars.name}}»</p><p>{% trans 'FROM_MEMBER' %} {{ user.full_name_or_short_name }}</p></div><div style="text-align: center"><h2>{% trans 'PROPOSAL_TITLE' %} № {{ proposal_short_hash }}</h2></div><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'BODY_INTRO' %}{% if proposal.fund_name %} {% trans 'BY_FUND' %} {{ proposal.fund_name }}{% endif %} {% trans 'IN_TOTAL' %} {{ proposal.total_amount }}{% if proposal.deadline %} {% trans 'DUE_BY' %} {{ proposal.deadline }}{% endif %}, {% trans 'BODY_NAMELY' %}:</p>{% for item in items %}<div style="padding-top: 10px"><p><strong>{{ item.number }}. {{ item.description }} — {{ item.amount }} ({% if item.mechanics == 'ADVANCE' %}{% trans 'MECH_ADVANCE' %}{% else %}{% trans 'MECH_DIRECT' %}{% endif %})</strong></p><p>{% trans 'ITEM_RECIPIENT' %}: {% if item.recipient_type == 'SELF' %}{{ user.full_name_or_short_name }}{% else %}{{ item.recipient_name }}{% endif %}</p>{% if item.requisites %}<p>{% trans 'ITEM_REQUISITES' %}: {{ item.requisites }}</p>{% endif %}{% if item.payment_purpose %}<p>{% trans 'ITEM_PAYMENT_PURPOSE' %}: {{ item.payment_purpose }}</p>{% endif %}</div>{% endfor %}<p>{% trans 'PURPOSE' %}: {{ proposal.description }}</p><div style="padding-top: 30px"><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    TO_COUNCIL: 'В Совет',
    FROM_MEMBER: 'от пайщика',
    PROPOSAL_TITLE: 'СЛУЖЕБНАЯ ЗАПИСКА',
    BODY_INTRO: 'Прошу согласовать списание затрат',
    BY_FUND: 'по',
    IN_TOTAL: 'в общей сумме',
    DUE_BY: 'в срок до',
    BODY_NAMELY: 'а именно',
    MECH_ADVANCE: 'аванс под отчёт',
    MECH_DIRECT: 'оплата по счёту',
    ITEM_RECIPIENT: 'Получатель',
    ITEM_REQUISITES: 'Реквизиты',
    ITEM_PAYMENT_PURPOSE: 'Назначение платежа',
    PURPOSE: 'Цель расходов',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: { city: 'Москва' },
  meta: { created_at: '02.06.2026 14:00' },
  vars: { full_abbr_genitive: 'ПК', name: 'Восход' },
  user: { full_name_or_short_name: 'Иванов И.И.' },
  proposal_hash: '55c470039a8c53ce1b4b6e842fe8063ab3d5b85ba2ba8ab0ae6e30be3ad328b7',
  proposal_short_hash: '55C470039A8C53CE',
  proposal: {
    description: 'Закупка хостинга и бухгалтерских услуг на июнь 2026',
    total_amount: '15000.00 RUB',
    items_count: 2,
    source_wallet: 'w.cap.bla',
    deadline: '30.06.2026',
    fund_name: 'Фонду хозяйственной деятельности',
  },
  items: [
    {
      number: '1',
      description: 'Аренда серверов Yandex Cloud (тариф S, июнь)',
      amount: '12000.00 RUB',
      recipient_type: 'ORG',
      mechanics: 'DIRECT',
      recipient_name: 'ООО «Яндекс.Облако»',
      requisites: 'ИНН 7704414297, р/с 40702810000000000000, БИК 044525000',
      payment_purpose: 'Оплата по счёту № 814 от 01.06.2026 за аренду серверов',
    },
    {
      number: '2',
      description: 'Канцелярия для офиса',
      amount: '3000.00 RUB',
      recipient_type: 'SELF',
      mechanics: 'ADVANCE',
      recipient_name: '',
      requisites: 'Банковский перевод: счёт 40817810000000000000, Банк ВТБ (ПАО), БИК 044525187',
    },
  ],
}
