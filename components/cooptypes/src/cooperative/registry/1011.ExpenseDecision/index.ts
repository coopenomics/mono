import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 1011

/**
 * Интерфейс генерации протокола решения совета по служебной записке о расходах
 * программы «Благорост» (соответствует записке 1010).
 */
export interface Action extends IGenerate {
  registry_id: number
  request_id: number
  decision_id: number
  statement_number: string
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  deadline: string
  total_amount: string
  items: string[]
  applicant_full_name: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  coop: ICooperativeData
  meta: IMetaDocument
  decision: IDecisionData
  vars: IVars
  statement_number: string
  project_name: string
  project_hash: string
  component_name: string
  component_hash: string
  deadline: string
  total_amount: string
  items: string[]
  applicant_full_name: string
}

export const title = 'Протокол решения совета по служебной записке о расходах программы Благорост'
export const description = 'Форма протокола решения совета по согласованию списания затрат по записке 1010 из средств программы «Благорост»'

export const context = `<style>
h1 { margin: 0; text-align: center; }
h3 { margin: 0; padding-top: 15px; }
.about { padding: 20px; }
.about p { margin: 0; }
.signature { padding-top: 20px; }
.digital-document { padding: 20px; white-space: pre-wrap; }
.subheader { padding-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
th { background-color: #f4f4f4; width: 30%; }
.items { padding-left: 32px; margin: 0; }
.items li { margin-bottom: 4px; }
</style>

<div class="digital-document">
<h1 class="header">{% trans 'protocol_number', decision.id %}</h1>
<p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
<p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>
<table class="about">
<tbody>
<tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr>
<tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr>
<tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr>
<tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr>
</tbody>
</table>
<h3>{% trans 'council_members' %}</h3>
<table>
<tbody>
{% for member in coop.members %}
<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>
{% endfor %}
</tbody>
</table>
<h3>{% trans 'meeting_legality' %}</h3>
<p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>
<h3>{% trans 'agenda' %}</h3>
<table>
<tbody>
<tr><th>№</th><td>{% trans 'question' %}</td></tr>
<tr><th>1</th><td>{% trans 'expense_question', statement_number, applicant_full_name, component_name, project_name, deadline, total_amount %}</td></tr>
</tbody>
</table>
<h3>{% trans 'expense_items_label' %}</h3>
<ol class="items">
{% for item in items %}<li>{{ item }}</li>
{% endfor %}
</ol>
<h3>{% trans 'voting' %}</h3>
<p>{% trans 'vote_results' %}</p>
<table>
<tbody>
<tr><th>{% trans 'votes_for' %}</th><td>{{ decision.votes_for }}</td></tr>
<tr><th>{% trans 'votes_against' %}</th><td>{{ decision.votes_against }}</td></tr>
<tr><th>{% trans 'votes_abstained' %}</th><td>{{ decision.votes_abstained }}</td></tr>
</tbody>
</table>
<h3>{% trans 'decision_made' %}</h3>
<table>
<tbody>
<tr><th>№</th><td>{% trans 'decision' %}</td></tr>
<tr><th>1</th><td>{% trans 'expense_decision', component_name, project_name, deadline, total_amount %}</td></tr>
</tbody>
</table>
<hr>
<p>{% trans 'closing_time', decision.time %}</p>
<div class="signature"><p>{% trans 'signature' %}</p><p>{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div>
</div>`

export const translations = {
  ru: {
    meeting_format: 'Форма',
    meeting_format_value: 'Заочная',
    meeting_place: 'Место',
    meeting_date: 'Дата',
    opening_time: 'Время открытия',
    council_members: 'ЧЛЕНЫ СОВЕТА',
    voting_results: 'Количество голосов составляет {0}% от общего числа членов Совета.',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    meeting_legality: 'СОБРАНИЕ ПРАВОМОЧНО',
    chairman_of_the_meeting: 'Председатель собрания совета: {0} {1} {2}',
    agenda: 'ПОВЕСТКА ДНЯ',
    question: 'Вопрос',
    expense_question:
      'О согласовании служебной записки № {0} от {1} по списанию затрат на реализацию Компонента "{2}" в рамках Проекта "{3}" в срок до {4} из средств программы "БЛАГОРОСТ" в общей сумме {5} руб.',
    expense_items_label: 'СОСТАВ ЗАТРАТ',
    voting: 'ГОЛОСОВАНИЕ',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    decision_made: 'РЕШИЛИ',
    decision: 'Решение',
    expense_decision:
      'Согласовать списание затрат на реализацию Компонента "{0}" в рамках Проекта "{1}" в срок до {2} в общей сумме {3} руб. из средств целевой потребительской программы "БЛАГОРОСТ" по Фонду хозяйственной деятельности.',
    closing_time: 'Время закрытия собрания совета: {0}.',
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета',
    chairman_of_the_council: 'Председатель совета',
    member_of_the_council: 'Член совета',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
  },
}

export const exampleData = {
  meta: {
    created_at: '02.06.2026 00:01',
  },
  statement_number: '12',
  applicant_full_name: 'Иванов Иван Иванович',
  project_name: 'Цифровой кооператив',
  project_hash: 'B2C3D4E5F6789ABC',
  component_name: 'Платёжный шлюз',
  component_hash: 'A1B2C3D4E5F6789A',
  deadline: '31.07.2026',
  total_amount: '150 000',
  items: [
    'Оплата хостинга и доменных имён за июль 2026 г. — 30 000 руб.',
    'Закупка SSL-сертификатов на 12 мес. — 20 000 руб.',
    'Оплата работ подрядчика по интеграции — 100 000 руб.',
  ],
  coop: {
    city: 'Москва',
    full_address: 'Смольная 3-84',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  decision: {
    time: '00:01',
    date: '02.06.2026',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
    id: '12',
  },
  vars: {
    full_abbr_genitive: 'потребительского кооператива',
    name: 'ВОСХОД',
  },
}
