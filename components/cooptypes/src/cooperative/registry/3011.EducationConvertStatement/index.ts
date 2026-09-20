import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3011

/**
 * Заявление пайщика о конвертации паевого взноса в членский взнос по
 * ЦПП «Образование» (процесс p.edu.access, шаг `edubridge::convert`).
 *
 * Генерируется и подписывается пайщиком при открытии или продлении
 * подписки на курс (по одному заявлению на период оплаты). On-chain уходит
 * параметром `statement` действия `edubridge::convert`; денежно ему
 * соответствует операция o.edu.conv (TRANSFER w.wal.share → w.edu.member,
 * Дт 80 / Кт 86). Зеркало 1110.MarketplaceConvertStatement.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Канонический идентификатор подписки on-chain (edusubs.sub_hash). */
  sub_hash: string
  /** Сумма конвертации паевого взноса, с валютой; «0.0000 RUB» — конвертировать нечего. */
  amount: string
  /** Сколько засчитывается с кошелька членских взносов программы, с валютой. */
  from_program: string
  /** Полная стоимость подписки, с валютой. */
  total: string
  /** Название курса. */
  course_title: string
  /** Период подписки: `month` | `course` (`year` — у прежних подписок). */
  period: string
}

export type Meta = IMetaDocument & Action

/**
 * Модель данных для PDF-рендера. Подписант пайщик (родитель-слушатель).
 * `period_human` человекочитаемый период (месяц / весь курс), вычисляется фабрикой.
 *
 * Курс и период в тексте заявления не печатаются: пайщик просит кооператив
 * конвертировать взнос, а к какому курсу это привело — учёт подписки, а не
 * предмет заявления (замечание владельца 2026-09-03). В модели поля остаются:
 * они уходят в мету документа и связывают заявление с подпиской.
 */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  sub_hash: string
  amount: string
  from_program: string
  total: string
  /** Часть взноса покрыта остатком кошелька программы — вычисляет фабрика. */
  from_program_used: boolean
  /** Остаётся недостача, её конвертируют с паевого — вычисляет фабрика. */
  convert_used: boolean
  course_title: string
  period: string
  period_human: string
}

export const title = 'Заявление о конвертации паевого взноса в членский взнос'
export const description = 'Заявление пайщика о конвертации паевого взноса в членский взнос по ЦПП «Образование» при оформлении подписки на курс'

// Вёрстка 1-в-1 с 1110 (см. комментарий там о sanitizeHtml/pre-wrap).
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

  <p>{% if from_program_used %}{% trans 'body_with_program', from_program, program.name, total %}{% if convert_used %} {% trans 'body_convert_rest', amount %}{% endif %}{% else %}{% trans 'body', amount, program.name %}{% endif %}</p>

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
    body_with_program: 'Прошу зачесть в оплату подписки остаток моего членского взноса в размере {0} по Целевой Потребительской Программе «{1}», общая стоимость подписки — {2}.',
    body_convert_rest: 'Недостающую часть прошу конвертировать из моего паевого взноса в размере {0}.',
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
  program: { name: 'ОБРАЗОВАНИЕ' },
  sub_hash: '0000abcd...',
  amount: '3000.00 RUB',
  from_program: '0.00 RUB',
  total: '3000.00 RUB',
  from_program_used: false,
  convert_used: true,
  course_title: 'Основы программирования',
  period: 'month',
  period_human: 'один месяц',
}
