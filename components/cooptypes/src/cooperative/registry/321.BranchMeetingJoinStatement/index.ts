import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 321

/**
 * Интерфейс генерации заявления пайщика о присоединении к собранию участка
 */
export interface Action extends IGenerate {
  hash: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  user: ICommonUser
  vars: IVars
}

export const title = 'Заявление о присоединении к собранию пайщиков кооперативного участка'
export const description = 'Форма заявления пайщика о присоединении к собранию пайщиков кооперативного участка'
export const context = `<style>.digital-document h1 {margin: 0px;text-align:center;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px;}.signature {padding-top: 30px;}</style><div class="digital-document"><h1 class="header">{% trans 'STATEMENT_TITLE' %}</h1><p style="text-align: center">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="text-align: right">{{ coop.city }}, {{ meta.created_at }}</p><p>{% trans 'JOIN_TEXT' %} {{ user.full_name_or_short_name }}.</p><div class="signature"><p>{% trans 'PARTICIPANT_LABEL' %} {{ user.full_name_or_short_name }}</p><p>{% trans 'SIGNED_DIGITALLY' %}</p></div></div>`

export const translations = {
  ru: {
    STATEMENT_TITLE: 'ЗАЯВЛЕНИЕ О ПРИСОЕДИНЕНИИ К СОБРАНИЮ',
    JOIN_TEXT: 'Прошу включить меня в состав участников собрания пайщиков кооперативного участка. Заявитель',
    PARTICIPANT_LABEL: 'Пайщик',
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
    full_name_or_short_name: 'Сидоров Иван Петрович',
  },
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
