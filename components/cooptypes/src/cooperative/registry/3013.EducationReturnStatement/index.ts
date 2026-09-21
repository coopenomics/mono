import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3013

/**
 * Заявление пайщика о прекращении участия в ЦПП «Образование» (процесс
 * p.edu.access, шаг `edubridge::retshare`).
 *
 * Членский взнос программы возвращается в паевой только с прекращением участия
 * в программе. После согласования Обществом кооператив закрывает подписки
 * пайщика с возвратом по Положению, весь остаток кошелька программы уходит в
 * паевой взнос (o.edu.retshr, Дт 86 / Кт 80), соглашение о программе
 * аннулируется. Сумма в заявлении не называется: остаток известен только в день
 * согласования, когда посчитаны возвраты по подпискам.
 */
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

/** Модель данных для PDF-рендера. Подписант — пайщик. */
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  program: ICommonProgram
}

export const title = 'Заявление о прекращении участия в ЦПП «Образование»'
export const description = 'Заявление пайщика о прекращении участия в ЦПП «Образование» с возвратом остатка членского взноса в паевой взнос'

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

  <p>{% trans 'body', program.name %}</p>
  <p>{% trans 'body_return', program.name %}</p>
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
    statement_subheader: 'о прекращении участия в Целевой Потребительской Программе «{0}»',
    body: 'Прошу прекратить моё участие в Целевой Потребительской Программе «{0}».',
    body_return: 'Мои подписки на курсы по программе прошу закрыть с возвратом членских взносов по Положению о Целевой Потребительской Программе «{0}», а весь остаток моего членского взноса по программе вернуть в мой паевой взнос по Целевой Потребительской Программе «Цифровой Кошелёк».',
    consent: 'Прекращение участия прошу произвести после согласования настоящего заявления Обществом.',
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
}
