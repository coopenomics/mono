import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 325

/**
 * Интерфейс генерации решения совета об учреждении кооперативного участка.
 * Реквизиты участка (наименование, адрес, председатель) фабрика извлекает
 * из решения собрания пайщиков по его хэшу.
 */
export interface Action extends IGenerate {
  decision_id: number
  hash: string
}

export type Meta = IMetaDocument & Action

// Модель данных
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  decision: IDecisionData
  braname: string
  address: string
  chairman_full_name: string
  vars: IVars
}

export const title = 'Решение совета об учреждении кооперативного участка'
export const description = 'Форма протокола решения совета кооператива об учреждении кооперативного участка'
export const context = `<style> h1 {margin: 0px; text-align:center;}h3{margin: 0px;padding-top: 15px;text-align: center;}.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;}th {background-color: #f4f4f4;width: 30% !important;}.signature {padding-top: 30px;}</style><div class="digital-document"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %}</p><p style="text-align:center">{{ vars.full_abbr_genitive }} «{{ vars.name }}»</p><p style="text-align: right; padding-top: 20px;"> {{ coop.city }}, {{ meta.created_at }}</p><h3 style="padding-top: 20px; padding-bottom: 10px;">{% trans 'agenda' %}</h3><p>{% trans 'agenda_item_text' %}.</p><table><tbody><tr><th>{% trans 'branch_name_label' %}</th><td>{{ braname }}</td></tr><tr><th>{% trans 'branch_address_label' %}</th><td>{{ address }}</td></tr><tr><th>{% trans 'chairman_label' %}</th><td>{{ chairman_full_name }}</td></tr></tbody></table><p><strong>{% trans 'voting_results_label' %}</strong>: {% trans 'votes_for_label' %} – {{ decision.votes_for }}; {% trans 'votes_against_label' %} - {{ decision.votes_against }}; {% trans 'votes_abstained_label' %} - {{ decision.votes_abstained }}.</p><h3 style="padding-top: 20px; padding-bottom: 10px;">{% trans 'decision_made' %}</h3><p>{% trans 'decision_text' %} «{{ braname }}» {% trans 'with_address' %} {{ address }}. {% trans 'elect_chairman' %} {{ chairman_full_name }}.</p><div class="signature"><p>{% trans 'chairman_council_signature' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_digitally' %}</p></div></div>`

export const translations = {
  ru: {
    protocol_number: 'Протокол № {0}',
    council_meeting_name: 'Собрания Совета',
    agenda: 'Повестка дня',
    agenda_item_text: 'Об учреждении кооперативного участка по заявлению председателя собрания пайщиков',
    branch_name_label: 'Наименование кооперативного участка',
    branch_address_label: 'Адрес привязки кооперативного участка',
    chairman_label: 'Избранный председатель кооперативного участка',
    voting_results_label: 'Итоги голосования',
    votes_for_label: 'за',
    votes_against_label: 'против',
    votes_abstained_label: 'воздержались',
    decision_made: 'РЕШИЛИ',
    decision_text: 'Учредить кооперативный участок',
    with_address: 'с привязкой к адресу',
    elect_chairman: 'Утвердить председателем кооперативного участка',
    chairman_council_signature: 'Председатель Совета',
    signed_digitally: 'подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    city: 'Москва',
    chairman: {
      last_name: 'Петров',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  meta: {
    created_at: '16.03.2024 12:00',
  },
  decision: {
    id: '16-03-2024',
    votes_for: 5,
    votes_against: 0,
    votes_abstained: 0,
  },
  braname: 'РОМАШКА',
  address: 'г. Красногорск, ул. Ленина, д. 1',
  chairman_full_name: 'Иванов Петр Сидорович',
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
}
