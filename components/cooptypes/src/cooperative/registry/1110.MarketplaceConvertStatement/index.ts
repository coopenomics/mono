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

// Вёрстка 1-в-1 с эталоном фабричного документа 1106/1109, которые КОРРЕКТНО
// отображаются и в повестке совета (рендерер BaseDocument), и в предпросмотре.
// BaseDocument прогоняет html через sanitizeHtml — он ВЫРЕЗАЕТ содержимое
// <style> документа (инлайн-стили выживают, блочные правила — нет) и форсит в
// Shadow DOM `.digital-document { white-space: pre-wrap }`. Поэтому:
// выравнивание — ИНЛАЙН (`style="text-align: ..."`, а не класс в <style>),
// вертикальный ритм — ПУСТЫМИ СТРОКАМИ под pre-wrap (не margin'ами), плотные
// абзацы внутри одного блока (шапка «В Совет»/«от пайщика», подпись) — одной
// строкой переноса без пустой строки между ними. Свой <style> ниже нужен
// только для нешадоу-рендеров (weasyprint, предпросмотр без BaseDocument).
export const context = `<style>
h1 { margin: 0px; text-align: center; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
</style>

<div class="digital-document">
  <div style="text-align: right">
    <p style="margin: 0">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p style="margin: 0">{% trans 'from_member' %} {{ user.full_name_or_short_name }}</p>
  </div>

  <div style="text-align: center">
    <h1 class="header">{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>

  <p>{% trans 'body', amount, program.name %}</p>

  <p>{% trans 'signature' %}</p>
  <p>{{ user.full_name_or_short_name }}</p>
  <p>{{ meta.created_at }}</p>
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
