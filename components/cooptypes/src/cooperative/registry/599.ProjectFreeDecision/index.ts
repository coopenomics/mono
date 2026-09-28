import type { IGenerate, IMetaDocument, IProjectData } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 599

/**
 * Интерфейс генерации решения совета
 */
export interface Action extends IGenerate {
  project_id: string
  title?: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  coop: ICooperativeData
  meta: IMetaDocument
  project: IProjectData
  suggester_name: string /// < кто предложил
  vars: IVars
}

export const title = 'Предложение повестки дня собрания совета'
export const description = 'Форма предложения повестки дня собрания совета'
export const context = '<style> \nh1 {\nmargin: 0px; \ntext-align:center;\n}\nh3{\nmargin: 0px;\npadding-top: 15px;\n}\n.about {\npadding: 20px;\n}\n.about p{\nmargin: 0px;\n}\n.signature {\npadding-top: 20px;\n}\n.digital-document {\npadding: 30px;\nwhite-space: pre-wrap;\n}\n.subheader {\npadding-bottom: 20px; \n}\n</style>\n\n<div class="digital-document"><h1 class="header">{% trans \'suggestion\' %}</h1>\n<p style="text-align:center" class="subheader">{% trans \'council_meeting_name\', vars.full_abbr_genitive, vars.name %}</p>\n<p style="text-align: right"> {{ created_at }}, {{ coop.city }}</p>\n<h3>{% trans \'agenda\' %}</h3>\n<ol><li> {{project.question}}</li></ol>\n<h3>{% trans \'decision_made\' %}</h3>\n<ol><li>{{project.decision}}</li></ol>\n<hr>\n\n<div class="signature"><p>{% trans \'signature\' %}<p><p>{{ suggester_name}} </p></div></div>'

export const translations = {
  ru: {
    agenda: 'Предложение в повестку дня',
    decision_made: 'Предлагаемое решение',
    signature: 'Документ подписан электронной подписью',
    suggestion: 'Предложение',
    council_meeting_name: 'повестки дня Собрания Совета {0} "{1}"',
  },
  // ... другие переводы
}

export const exampleData = {
  meta: {
    created_at: '12.02.2024 00:01',
  },
  coop: {
    city: 'Москва',
  },
  project: {
    decision: 'Решили то да сё',
    question: 'Решить то да сё',
  },
  suggester_name: 'Муравьев Алексей Николаевич',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
