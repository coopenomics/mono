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
  /** Стоимость списания (4 знака после запятой, валюта `_root_govern_symbol`). */
  amount: string
  /** Причина списания (просрочка / порча / малооценность). */
  reason: string
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

// Без white-space: pre-wrap — иначе переносы строк исходника рендерятся как
// видимые отступы. Интервалы — через margin абзацев.
export const context = `<style>
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.digital-document h1 { margin: 0; text-align: center; }
.title-block { text-align: center; margin-bottom: 20px; }
.subheader { margin-top: 4px; }
.sign { margin-top: 24px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
th { font-weight: bold; }
</style>

<div class="digital-document">
  <div class="title-block">
    <h1>{% trans 'memo_title' %}</h1>
    <p class="subheader">{% trans 'memo_subheader', branch_name %}</p>
  </div>

  <p>{% trans 'preamble', program.name, cycle_started_at %}</p>

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

  <p>{% trans 'confirmation' %}</p>
  <p>{% trans 'proposal_ref' %} {{ proposal_hash }}</p>
  <p>{% trans 'ledger_note' %}</p>

  <hr />
  <p>{% trans 'signature' %}</p>
  <p>{% trans 'chairman_of_branch', branch_name %} {{ chairman.full_name_or_short_name }}</p>
  <p>{{ meta.created_at }}</p>
</div>
`

export const translations = {
  ru: {
    memo_title: 'СЛУЖЕБНАЯ ЗАПИСКА',
    memo_subheader: 'о списании имущества со склада кооперативного участка «{0}»',
    preamble: 'По решению совета кооператива в рамках Целевой Потребительской Программы «{0}» (цикл от {1}) подтверждаю фактическое списание и выбытие со склада кооперативного участка следующего имущества, признанного непригодным к выдаче пайщикам:',
    col_asset: 'Наименование/Артикул',
    col_quantity: 'Количество',
    col_amount: 'Сумма списания',
    col_reason: 'Причина',
    total: 'ИТОГО',
    confirmation: 'Списание произведено. Имущество физически выбыло со склада кооперативного участка и снято с учёта.',
    proposal_ref: 'Идентификатор проекта списания:',
    ledger_note: 'Списание оформляется бухгалтерской проводкой Дт 86 «Целевое финансирование» / Кт 10 «Материалы»; движений по кошелькам пайщиков не производится.',
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
      amount: '1020.0000',
      reason: 'Истёк срок годности',
    },
    {
      asset_title: 'Молоко «Доброе», 1 л',
      quantity: '5',
      amount: '485.0000',
      reason: 'Повреждена упаковка',
    },
  ],
  total_amount: '1505.0000',
}
