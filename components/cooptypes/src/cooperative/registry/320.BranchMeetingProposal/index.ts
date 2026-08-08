import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 320

/**
 * Вопрос повестки собрания пайщиков кооперативного участка
 */
interface IBranchAgendaQuestion {
  number: string
  title: string
  context?: string
  decision: string
}

/**
 * Интерфейс генерации предложения повестки собрания пайщиков кооперативного участка.
 * Документ содержит только повестку: наименование, адрес привязки и председатель
 * определяются собранием позже; место и время проведения собрания — приватные
 * данные пайщиков и в подписываемый документ (он публикуется в блокчейне) не входят.
 */
export interface Action extends IGenerate {
  type: 'createbranch' | 'free'
  hash: string
  questions: IBranchAgendaQuestion[]
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  type: 'createbranch' | 'free'
  questions: IBranchAgendaQuestion[]
  vars: IVars
}

export const title = 'Предложение повестки собрания пайщиков кооперативного участка'
export const description = 'Форма предложения повестки собрания пайщиков для принятия решения участка (в т.ч. об учреждении кооперативного участка)'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.about {padding: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px; }table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word; overflow-wrap: break-word; }th {background-color: #f4f4f4;width: 30% !important;max-width: 30% !important;}</style><div class="digital-document"><div style="padding-bottom: 30px;"><h1 style="text-align:center">{% trans 'PROPOSAL_TITLE' %}</h1><p style="text-align:center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right; padding-top: 20px">{{ coop.city }}, {{ meta.created_at }}</p></div><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'AGENDA_QUESTIONS' %}</h3><table><tbody>{% for question in questions %}<tr><th>{{ question.number }}.</th><td>{{ question.title }}</td></tr>{% if question.context %}<tr><th></th><td><em>{{ question.context }}</em></td></tr>{% endif %}{% endfor %}</tbody></table><h3 style="padding-top: 30px; padding-bottom: 10px;">{% trans 'PROJECT_DECISIONS' %}</h3><table><tbody>{% for question in questions %}<tr><th>{% trans 'PROJECT_DECISION_LABEL' %} {{ question.number }}</th><td>{{ question.decision }}</td></tr>{% endfor %}</tbody></table><div class="signature"><div style="padding-top: 20px;"><p>{{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div></div>`

export const translations = {
  ru: {
    PROPOSAL_TITLE: 'ПРЕДЛОЖЕНИЕ ПОВЕСТКИ СОБРАНИЯ ПАЙЩИКОВ',
    AGENDA_QUESTIONS: 'ВОПРОСЫ ПОВЕСТКИ ДНЯ',
    PROJECT_DECISIONS: 'ПРОЕКТЫ РЕШЕНИЙ',
    PROJECT_DECISION_LABEL: 'ПРОЕКТ РЕШЕНИЯ по вопросу',
    SIGNED_DIGITALLY: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
  },
  meta: {
    created_at: '12.02.2024 10:30',
  },
  user: {
    full_name_or_short_name: 'Иванов Петр Сидорович',
  },
  type: 'createbranch',
  questions: [
    {
      number: '1',
      title: 'Об организации кооперативного участка',
      context: 'Учреждение кооперативного участка по месту, определяемому собранием.',
      decision: 'Организовать кооперативный участок по адресу привязки, определённому собранием пайщиков',
    },
    {
      number: '2',
      title: 'Об избрании председателя кооперативного участка',
      context: 'Избрание председателя из числа участников собрания.',
      decision: 'Избрать председателем кооперативного участка председателя настоящего собрания пайщиков',
    },
  ],
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
