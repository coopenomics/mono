import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1111

/**
 * Служебная записка о списании имущества со склада кооперативного участка —
 * Эпик 8 ЦПП «Стол заказов» (членские взносы).
 *
 * Завершающий документ пути списания скоропорта. Совет своим решением
 * (Протокол 1107) лишь признаёт списание допустимым; имущество физически
 * выбывает со склада только после того, как ответственный за склад
 * председатель кооперативного участка подпишет эту записку и тем самым
 * подтвердит фактическое списание. Подпись инициирует on-chain action
 * `marketplace::confirmwroff(coopname, signer, proposal_hash, braname, memo)`,
 * который проводит ledger2-операции `o.mkt.wroff` по всем неисполненным
 * позициям данного КУ. Документ публикуется в реестр документов в пакете
 * процесса списания (package = proposal_hash), рядом с Заявлением 1108 и
 * Протоколом совета 1107.
 *
 * Гранулярность — по одному кооперативному участку: председатель КУ
 * подтверждает списание только своей части проекта.
 */
export interface WriteoffMemoItem {
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
  /** Кооперативный участок (склад) — источник списания. */
  braname: string
  /** Человеко-читаемое имя кооперативного участка для шапки документа. */
  branch_name: string
  /** Идентификатор расчётного цикла списания (ISO-дата начала цикла). */
  cycle_started_at: string
  /** Позиции к списанию по данному КУ. */
  items: WriteoffMemoItem[]
  /** Σ items.amount по данному КУ. */
  total_amount: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера Служебной записки о списании.
 * Подписант — председатель кооперативного участка.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  chairman: ICommonUser
  program: ICommonProgram
  proposal_hash: string
  branch_name: string
  cycle_started_at: string
  items: WriteoffMemoItem[]
  total_amount: string
}

export const title = 'Служебная записка о списании'
export const description = 'Служебная записка председателя кооперативного участка о фактическом списании со склада скоропортящегося, повреждённого или малооценного имущества по решению совета (ЦПП «Стол заказов»)'

// Вёрстка 1-в-1 с эталоном фабричного документа 1106 (Заявление о возврате),
// который КОРРЕКТНО отображается и в повестке совета (рендерер BaseDocument), и
// в предпросмотре. BaseDocument прогоняет html через sanitizeHtml — он ВЫРЕЗАЕТ
// <style> документа и форсит в Shadow DOM `.digital-document{white-space:pre-wrap}`.
// Поэтому: выравнивание — ИНЛАЙН (`style="text-align"`), вертикальный ритм —
// ПУСТЫМИ СТРОКАМИ под pre-wrap, плотные абзацы — инлайн `margin:0px`,
// центр-заголовок — <h1 class="header">. Шапка таблицы — <td style="font-weight">,
// не <th> (рендерер навязывает th{width:30%}). Свой <style> — для нешадоу-рендеров.
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
  <div style="text-align: center">
    <h1 class="header">{% trans 'memo_title' %}</h1>
    <p class="subheader">{% trans 'memo_subheader', branch_name %}</p>
  </div>

  <p>{% trans 'preamble', program.name, cycle_started_at %}</p>

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

  <p>{% trans 'confirmation' %}</p>

  <p>{% trans 'signature' %}</p>
  <p style="margin: 0px">{% trans 'chairman_of_branch', branch_name %} {{ chairman.full_name_or_short_name }}</p>
  <p style="margin: 0px">{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    memo_title: 'СЛУЖЕБНАЯ ЗАПИСКА',
    memo_subheader: 'о списании имущества со склада кооперативного участка «{0}»',
    preamble: 'По решению совета кооператива в рамках Целевой Потребительской Программы «{0}» (цикл от {1}) подтверждаю фактическое списание и выбытие со склада кооперативного участка следующего имущества, признанного непригодным к выдаче пайщикам:',
    col_asset: 'Наименование/Артикул',
    col_quantity: 'Количество',
    col_unit: 'Ед. изм.',
    col_amount: 'Сумма списания',
    total: 'ИТОГО',
    confirmation: 'Списание произведено. Имущество физически выбыло со склада кооперативного участка и снято с учёта.',
    signature: 'Подписано электронной подписью.',
    chairman_of_branch: 'Председатель кооперативного участка «{0}»:',
  },
}

export const exampleData = {
  meta: { created_at: '13.06.2026 12:00' },
  coop: {
    short_name: 'ПК ВОСХОД',
    city: 'Москва',
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  chairman: { full_name_or_short_name: 'Иванов Иван Иванович' },
  program: { name: 'СТОЛ ЗАКАЗОВ' },
  proposal_hash: '0000abcd...',
  branch_name: 'Кооперативный участок «Москва-1»',
  cycle_started_at: '2026-06-01',
  items: [
    {
      asset_title: 'Сахар-песок «Сладкий», 1 кг',
      quantity: '12',
      unit: 'шт.',
      amount: '1 020,00 RUB',
    },
    {
      asset_title: 'Молоко «Доброе», 1 л',
      quantity: '5',
      unit: 'шт.',
      amount: '485,00 RUB',
    },
  ],
  total_amount: '1 505,00 RUB',
}
