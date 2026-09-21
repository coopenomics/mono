import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3013

/**
 * Заявление пайщика о возврате членского взноса по ЦПП «Образование» в паевой
 * взнос (процесс p.edu.access, шаг `edubridge::retshare`).
 *
 * Возвращённые участнику средства остаются на его кошельке программы и по
 * пунктам 4.2.4 и 4.2.5 Положения о ЦПП «Образование» доступны для возврата в
 * Цифровой Кошелёк — по заявлению Участника и согласованию Общества. Заявление
 * подписывает пайщик; после согласования оно уходит параметром `statement`
 * действия `edubridge::retshare`, денежно ему соответствует операция
 * o.edu.retshr (TRANSFER w.edu.member → w.wal.share, Дт 86 / Кт 80). Зеркало
 * 3011.EducationConvertStatement в обратную сторону.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** Сумма возврата членского взноса в паевой взнос, с валютой. */
  amount: string
}

export type Meta = IMetaDocument & Action

/** Модель данных для PDF-рендера. Подписант — пайщик. */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
  amount: string
}

export const title = 'Заявление о возврате членского взноса в паевой взнос'
export const description = 'Заявление пайщика о возврате остатка членского взноса по ЦПП «Образование» в паевой взнос'

// Вёрстка 1-в-1 с 3011.
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
  <p>{% trans 'consent' %}</p>

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
    statement_subheader: 'о возврате членского взноса по Целевой Потребительской Программе «{0}» в паевой взнос',
    body: 'Прошу вернуть остаток моего членского взноса по Целевой Потребительской Программе «{1}» в размере {0} в мой паевой взнос по Целевой Потребительской Программе «Цифровой Кошелёк».',
    consent: 'Возврат прошу произвести после согласования настоящего заявления Обществом.',
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
  amount: '3000.00 RUB',
}
