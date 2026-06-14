import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1108

/**
 * Заявление председателя о списании скоропорта со складов кооперативных
 * участков — Эпик 8 ЦПП «Стол заказов» (членские взносы).
 *
 * Подписывается председателем (initiator) и сразу после `marketplace::
 * propwroff` отправляется в `soviet::createagenda(type=mktwroff, callback=
 * marketplace::onmktwoauth/onmktwodecl, statement=signed_1106)` —
 * становится повесткой совета. После голосования совета chairman
 * подписывает Протокол списания (registry 1105), `soviet::exec` зовёт
 * callback `marketplace::onmktwoauth` и backend циклом запускает
 * `marketplace::execwroff` per-item (atomic-пара o.mkt.wroff + o.mkt.wroff2
 * через транзит 91).
 */
export interface WriteoffItemAction {
  /** Кооперативный участок (склад) источник позиции. */
  braname: string
  /** Краткое название позиции (название товара или артикул). */
  asset_title: string
  /** Количество единиц к списанию. */
  quantity: string
  /** Стоимость списания (4 знака после запятой, валюта `_root_govern_symbol`). */
  amount: string
  /** Причина списания (просрочка / порча / малооценность). */
  reason: string
}

export interface Action extends IGenerate {
  registry_id: number
  /** Канонический proposal_hash on-chain (якорь к wroffprops.hash). */
  proposal_hash: string
  /** Идентификатор расчётного цикла списания (ISO-дата начала цикла). */
  cycle_started_at: string
  /** Позиции к списанию (полная корзина проекта). */
  items: WriteoffItemAction[]
  /** Σ items.amount — для UI и шапки документа. */
  total_amount: string
}

export type Meta = IMetaDocument & Action

export interface WriteoffItemModel {
  braname: string
  asset_title: string
  quantity: string
  amount: string
  reason: string
}

/**
 * Модель данных для PDF-рендера Заявления о списании скоропорта.
 * Подписант — председатель (от имени совета).
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  chairman: ICommonUser
  program: ICommonProgram
  proposal_hash: string
  cycle_started_at: string
  items: WriteoffItemModel[]
  total_amount: string
}

export const title = 'Заявление о списании скоропорта'
export const description = 'Заявление председателя в совет кооператива о признании списания со складов кооперативных участков скоропортящегося, повреждённого или малооценного имущества по ЦПП «Стол заказов»'

// Без white-space: pre-wrap — иначе каждый перенос строки в исходнике шаблона
// рендерится как видимый отступ. Интервалы задаём через margin абзацев.
export const context = `<style>
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.digital-document h1 { margin: 0; text-align: center; }
.addressee { text-align: right; margin-bottom: 24px; }
.title-block { text-align: center; margin-bottom: 12px; }
.subheader { margin-top: 4px; }
.place { text-align: right; margin-bottom: 12px; }
.sign { margin-top: 24px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
th { font-weight: bold; }
</style>

<div class="digital-document">
  <div class="addressee">
    <p>{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p>{% trans 'from_chairman' %} {{ chairman.full_name_or_short_name }}</p>
  </div>

  <div class="title-block">
    <h1>{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>

  <p class="place">г. {{ coop.city }}</p>

  <p>{% trans 'preamble', cycle_started_at %}</p>

  <table>
    <thead>
      <tr>
        <th>№</th>
        <th>{% trans 'col_asset' %}</th>
        <th>{% trans 'col_quantity' %}</th>
        <th>{% trans 'col_amount' %}</th>
        <th>{% trans 'col_reason' %}</th>
      </tr>
    </thead>
    <tbody>
      {% for it in items %}
      <tr>
        <td>{{ forloop.counter }}</td>
        <td>{{ it.asset_title }}</td>
        <td>{{ it.quantity }}</td>
        <td>{{ it.amount }}</td>
        <td>{{ it.reason }}</td>
      </tr>
      {% endfor %}
      <tr style="font-weight: bold">
        <td colspan="3">{% trans 'total' %}</td>
        <td>{{ total_amount }}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="sign">
    <p>{% trans 'signature' %}</p>
    <p>{{ chairman.full_name_or_short_name }}</p>
    <p>{{ meta.created_at }}</p>
  </div>
</div>
`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_chairman: 'от Председателя',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о списании имущества со складов кооперативных участков по Целевой Потребительской Программе «{0}»',
    preamble: 'Прошу совет принять решение о списании с балансов кооперативных участков следующих позиций имущества, признанных от {0} непригодными к выдаче пайщикам:',
    col_asset: 'Наименование/Артикул',
    col_quantity: 'Количество',
    col_amount: 'Сумма списания',
    col_reason: 'Причина',
    total: 'ИТОГО',
    signature: 'Подписано электронной подписью.',
  },
}

export const exampleData = {
  meta: { created_at: '01.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  chairman: { full_name_or_short_name: 'Муравьев Алексей Николаевич' },
  program: { name: 'СТОЛ ЗАКАЗОВ' },
  proposal_hash: '0000abcd...',
  cycle_started_at: '01.06.2026',
  items: [
    {
      braname: 'ku-moskva-1',
      asset_title: 'Сахар-песок «Сладкий», 1 кг',
      quantity: '12',
      amount: '1020.0000 RUB',
      reason: 'Истёк срок годности',
    },
    {
      braname: 'ku-moskva-2',
      asset_title: 'Молоко «Доброе», 1 л',
      quantity: '5',
      amount: '485.0000 RUB',
      reason: 'Повреждена упаковка',
    },
  ],
  total_amount: '1505.0000 RUB',
}
