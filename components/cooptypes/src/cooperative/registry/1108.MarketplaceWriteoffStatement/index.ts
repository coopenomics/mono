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
  /** Единица измерения (шт. / кг / л / упак.) — снапшот с оффера товара. */
  unit: string
  /** Стоимость списания (4 знака после запятой, валюта `_root_govern_symbol`). */
  amount: string
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
  unit: string
  amount: string
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

// Вёрстка 1-в-1 с эталоном фабричного документа 1106 (Заявление о возврате),
// который КОРРЕКТНО отображается и в повестке совета (рендерер BaseDocument), и
// в предпросмотре. Ключевое: BaseDocument прогоняет html через sanitizeHtml —
// он ВЫРЕЗАЕТ <style> документа и принудительно ставит в Shadow DOM
// `.digital-document { white-space: pre-wrap }`. Поэтому вёрстка НЕ должна
// полагаться на <style> с классами (он исчезнет): выравнивание задаём ИНЛАЙН
// (`style="text-align: ..."` — инлайн переживает sanitize), вертикальный ритм —
// ПУСТЫМИ СТРОКАМИ под pre-wrap (а не margin'ами), плотные абзацы — инлайн
// `margin: 0px`. Центр-заголовок — <h1 class="header"> (shadowStyles центрирует
// `.digital-document .header`). Многоколоночная таблица позиций использует
// <td style="font-weight:bold"> для шапки (а не <th>: рендерер навязывает
// th{width:30%}, и пять <th> уехали бы за край). Свой <style> ниже нужен для
// нешадоу-рендеров (предпросмотр) и совпадает с 1106.
export const context = `<style>
h1 {
  margin: 0px;
  text-align: center;
}
.digital-document {
  padding: 20px;
  white-space: pre-wrap;
}
.subheader {
  padding-bottom: 20px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid currentColor;
  padding: 8px;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>

<div class="digital-document">
  <div style="text-align: right">
    <p style="margin: 0px !important">{% trans 'v_soviet' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
    <p style="margin: 0px !important">{% trans 'from_chairman' %} {{ chairman.full_name_or_short_name }}</p>
  </div>

  <div style="text-align: center">
    <h1 class="header">{% trans 'statement_title' %}</h1>
    <p class="subheader">{% trans 'statement_subheader', program.name %}</p>
  </div>

  <p style="text-align: right; margin: 0px">{% trans 'place', coop.city %}</p>

  <p>{% trans 'preamble', cycle_started_at %}</p>

  <table>
    <tbody>
      <tr>
        <td style="font-weight: bold">№</td>
        <td style="font-weight: bold">{% trans 'col_asset' %}</td>
        <td style="font-weight: bold">{% trans 'col_quantity' %}</td>
        <td style="font-weight: bold">{% trans 'col_unit' %}</td>
        <td style="font-weight: bold">{% trans 'col_amount' %}</td>
      </tr>
      {% for it in items %}
      <tr>
        <td>{{ forloop.counter }}</td>
        <td>{{ it.asset_title }}</td>
        <td>{{ it.quantity }}</td>
        <td>{{ it.unit }}</td>
        <td>{{ it.amount }}</td>
      </tr>
      {% endfor %}
      <tr>
        <td colspan="4" style="font-weight: bold">{% trans 'total' %}</td>
        <td style="font-weight: bold">{{ total_amount }}</td>
      </tr>
    </tbody>
  </table>

  <p>{% trans 'signature' %}</p>
  <p style="margin: 0px">{{ chairman.full_name_or_short_name }}</p>
  <p style="margin: 0px">{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    v_soviet: 'В Совет',
    from_chairman: 'от Председателя Совета',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_subheader: 'о списании имущества со складов кооперативных участков по Целевой Потребительской Программе «{0}»',
    place: 'г. {0}',
    preamble: 'Прошу совет принять решение о списании с балансов кооперативных участков следующих позиций имущества, признанных от {0} непригодными к выдаче пайщикам:',
    col_asset: 'Наименование/Артикул',
    col_quantity: 'Количество',
    col_unit: 'Ед. изм.',
    col_amount: 'Сумма списания',
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
      unit: 'шт.',
      amount: '1 020,00 RUB',
    },
    {
      braname: 'ku-moskva-2',
      asset_title: 'Молоко «Доброе», 1 л',
      quantity: '5',
      unit: 'шт.',
      amount: '485,00 RUB',
    },
  ],
  total_amount: '1 505,00 RUB',
}
