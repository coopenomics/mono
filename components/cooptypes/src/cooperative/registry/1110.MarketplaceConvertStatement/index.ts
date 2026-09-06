import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1110

/**
 * Заявление пайщика о переводе паевого взноса из Цифрового кошелька в ЦПП
 * «Стол заказов» с выделением членского взноса (паевая модель, компонент 68,
 * решение владельца 06.09.2026: членская часть остаётся только для взноса
 * кооперативного участка).
 *
 * Текст — на полную сумму заказа: «прошу перевести с баланса моего Цифрового
 * кошелька на баланс ЦПП «Стол заказов» {amount}, из них членский взнос
 * {membership_fee}». По кошелькам проходят обе части, каждая своим путём:
 * паевая — по паевым кошелькам (w.wal.share → w.mkt.order, резерв под заказ
 * без проводки), членская — по членским (из паевого в членский кошелёк
 * программы `w.mkt.member` переходит недостающая до взноса часть
 * {convert_amount}, Дт 80 / Кт 86; остаток кошелька зачитывается сам — тогда
 * в заявлении есть строка о зачёте; затем взнос уходит в пул взносов под
 * заказ). Подписывается заказчиком при
 * оформлении каждого заказа; при заказе из остатка — вместе с заявлением о
 * выдаче (источник — свободный паевой программы, `source = market`); при
 * факте больше заказа — у стойки на доплату и довзнос. On-chain уходит
 * параметром `convert_statement` действий `marketplace::createorder` /
 * `marketplace::stockorder` / `marketplace::issuestmt`; контракт публикует
 * его в реестр документов самостоятельным пакетом (package = hash заявления).
 *
 * Денежно заявлению соответствуют o.mkt.lock (тело) и o.mkt.conv
 * (w.wal.share → w.mkt.member, Дт 80 / Кт 86) либо o.mkt.lockp и o.mkt.convp
 * (со свободного паевого программы); сам взнос под заказ — o.mkt.fee с
 * членского кошелька, сторно при отмене — обратно на членский кошелёк.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор заказа on-chain (якорь к o.mkt.order). */
  order_hash: string
  /** Полная сумма перевода в программу: стоимость имущества вместе с членским взносом, с валютой. */
  amount: string
  /** Членский взнос кооперативного участка в составе суммы, с валютой. */
  membership_fee: string
  /** Часть взноса, которая переходит из паевого в членский по этому заявлению, с валютой (остальное — зачёт членского кошелька). */
  convert_amount: string
  /** Ставка членского взноса кооператива, процентов. */
  fee_percent: number
  /** Откуда переводится: `wallet` — Цифровой кошелёк, `market` — свободный паевой Стола заказов. */
  source: 'wallet' | 'market'
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
  membership_fee: string
  convert_amount: string
  fee_percent: number
  source: 'wallet' | 'market'
  /** Сумма членского взноса, зачтённая из остатка членского кошелька (amount − convert). Пусто — зачёта нет. */
  credited_amount?: string
}

export const title = 'Заявление о переводе паевого взноса в ЦПП «Стол заказов» с уплатой членского взноса'
export const description = 'Заявление пайщика о переводе паевого взноса из Цифрового кошелька в ЦПП «Стол заказов» на полную сумму заказа с выделением членского взноса кооперативного участка'

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

  {% if source == 'market' %}
  <p>{% trans 'body_market', program.name, amount, membership_fee %}</p>
  {% else %}
  <p>{% trans 'body_wallet', program.name, amount, membership_fee %}</p>
  {% endif %}
  <p>{% trans 'rate', fee_percent %}</p>
  {% if credited_amount %}
  <p>{% trans 'credited', credited_amount, convert_amount %}</p>
  {% endif %}

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
    statement_subheader: 'о переводе паевого взноса в Целевую Потребительскую Программу «{0}» и уплате членского взноса',
    body_wallet: 'Прошу перевести с баланса моего Цифрового кошелька на баланс Целевой Потребительской Программы «{0}» {1}, из них членский взнос {2}.',
    body_market: 'Прошу перевести с баланса моего свободного паевого взноса в Целевой Потребительской Программе «{0}» на оплату заказа {1}, из них членский взнос {2}.',
    rate: 'Членский взнос кооперативного участка — по единой ставке кооператива {0} %.',
    credited: 'В счёт членского взноса зачитывается ранее внесённый членский взнос {0}; из паевого взноса в членский переводится {1}.',
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
  amount: '910.0000 RUB',
  membership_fee: '210.0000 RUB',
  convert_amount: '210.0000 RUB',
  fee_percent: 30,
  source: 'wallet',
}
