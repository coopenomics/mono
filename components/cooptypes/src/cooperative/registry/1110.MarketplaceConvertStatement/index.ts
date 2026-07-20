import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1110

/**
 * Заявление пайщика о конвертации паевого взноса в членский взнос по
 * ЦПП «Стол заказов» (процесс p.mkt.supply, шаг createorder/stockorder).
 *
 * Генерируется и подписывается заказчиком в момент оформления заказа —
 * по одному заявлению на каждый Order (сумма = стоимость заказа плюс
 * членский взнос по ставке кооператива). On-chain уходит параметром
 * `convert_statement` действий `marketplace::createorder` /
 * `marketplace::stockorder`; контракт публикует его в реестр документов
 * самостоятельным пакетом (package = hash заявления) — конвертация
 * относится к программе, а не к процессу поставки (тот группируется
 * вокруг order_hash актами приёма-передачи).
 *
 * Денежно конвертации соответствуют операции o.mkt.lock (резерв заказа)
 * и o.mkt.fee (членский взнос) с паевого кошелька w.wal.share.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор заказа on-chain (якорь к o.mkt.order). */
  order_hash: string
  /** Сумма конвертации (стоимость заказа + членский взнос), с валютой. */
  amount: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера Заявления о конвертации.
 * Подписант — пайщик-заказчик.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  order_hash: string
  amount: string
}

export const title = 'Заявление о конвертации паевого взноса в членский взнос'
export const description = 'Заявление пайщика о конвертации паевого взноса в членский взнос по ЦПП «Стол заказов» при оформлении заказа'

// Без white-space: pre-wrap — иначе каждый перенос строки в исходнике шаблона
// превращается в вертикальный зазор и документ выглядит «разорванным».
// Отступы между блоками задаются margin'ами явно (компактный эталон — 1080).
export const context = `<style>
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.digital-document h1 { margin: 0; text-align: center; }
.digital-document .addressee { text-align: right; margin-bottom: 24px; }
.digital-document .title-block { text-align: center; margin-bottom: 24px; }
.digital-document .subheader { margin-top: 4px; }
.digital-document .sign { margin-top: 24px; }
</style>
<div class="digital-document">
  <div class="addressee">
    <p>{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p>{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p>
  </div>
  <div class="title-block">
    <h1>{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>
  <p>{% trans 'body', amount, program.name %}</p>
  <div class="sign">
    <p>{% trans 'signature' %}</p>
    <p>{{ user.full_name_or_short_name }}</p>
    <p>{{ meta.created_at }}</p>
  </div>
</div>
`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_member: 'от пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о конвертации паевого взноса в членский взнос по Целевой Потребительской Программе «{0}»',
    body: 'Прошу конвертировать мой паевой взнос в размере {0} в членский взнос по Целевой Потребительской Программе «{1}».',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  user: { full_name_or_short_name: 'Иванов Иван Иванович' },
  program: { name: 'СТОЛ ЗАКАЗОВ' },
  order_hash: '0000abcd...',
  amount: '935.0000 RUB',
}
