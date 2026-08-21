import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonProgram, ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 3009

/**
 * Протокол совета о приёме паевого взноса результатом интеллектуальной
 * деятельности преподавателя (ЦПП «Образование», процесс p.edu.rid).
 * Документ-Решение совета по Заявлению 3008; подписывается председателем
 * через стандартный sov.decision-flow и уходит параметром `decision`
 * действия `edubridge::acceptrid` (либо `declinerid`).
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions. */
  decision_id: number
  /** Канонический идентификатор взноса РИД on-chain. */
  rid_hash: string
  /** Принимаемая стоимость РИД, с валютой. */
  amount: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  user: ICommonUser
  program: ICommonProgram
  rid_hash: string
  amount: string
}

export const title = 'Протокол совета о приёме паевого взноса результатом интеллектуальной деятельности'
export const description = 'Форма протокола решения совета о приёме паевого взноса преподавателя результатом интеллектуальной деятельности по ЦПП «Образование»'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
h3 { margin: 0px; padding-top: 15px; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
th {  width: 30%; }
</style>

<div class="digital-document">
  <h1>{% trans 'protocol_number', decision.id %}</h1>
  <p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p>
  <p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>

  <table>
    <tbody>
      <tr>
        <th>{% trans 'meeting_format' %}</th>
        <td>{% trans 'meeting_format_value' %}</td>
      </tr>
      <tr>
        <th>{% trans 'meeting_place' %}</th>
        <td>{{ coop.full_address }}</td>
      </tr>
      <tr>
        <th>{% trans 'meeting_date' %}</th>
        <td>{{ decision.date }}</td>
      </tr>
      <tr>
        <th>{% trans 'opening_time' %}</th>
        <td>{{ decision.time }}</td>
      </tr>
    </tbody>
  </table>

  <h3>{% trans 'council_members' %}</h3>
  <table>
    <tbody>
      {% for member in coop.members %}
      <tr>
        <th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th>
        <td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <h3>{% trans 'meeting_legality' %}</h3>
  <p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p>

  <h3>{% trans 'agenda' %}</h3>
  <table>
    <tbody>
      <tr>
        <th>№</th>
        <td>{% trans 'question' %}</td>
      </tr>
      <tr>
        <th>{% trans 'agenda_item' %}</th>
        <td>{% trans 'agenda_subject', user.full_name_or_short_name, amount, program.name %}</td>
      </tr>
    </tbody>
  </table>

  <h3>{% trans 'voting' %}</h3>
  <p>{% trans 'vote_results' %}</p>
  <table>
    <tbody>
      <tr>
        <th>{% trans 'votes_for' %}</th>
        <td>{{ decision.votes_for }}</td>
      </tr>
      <tr>
        <th>{% trans 'votes_against' %}</th>
        <td>{{ decision.votes_against }}</td>
      </tr>
      <tr>
        <th>{% trans 'votes_abstained' %}</th>
        <td>{{ decision.votes_abstained }}</td>
      </tr>
    </tbody>
  </table>

  <h3>{% trans 'decision_made' %}</h3>
  <table>
    <tbody>
      <tr>
        <th>№</th>
        <td>{% trans 'question' %}</td>
      </tr>
      <tr>
        <th>{% trans 'decision' %}</th>
        <td>{% trans 'decision_text', amount, user.full_name_or_short_name, program.name, rid_hash %}</td>
      </tr>
    </tbody>
  </table>

  <hr />
  <p>{% trans 'closing_time', decision.time %}</p>
  <div class="signature">
    <p>{% trans 'signature' %}</p>
    <p>{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p>
  </div>
</div>
`

export const translations = {
  ru: {
    meeting_format: 'Форма',
    meeting_date: 'Дата',
    meeting_place: 'Место',
    opening_time: 'Время открытия',
    council_members: 'ЧЛЕНЫ СОВЕТА',
    voting_results: 'Количество голосов составляет {0}% от общего числа членов Совета.',
    meeting_legality: 'СОБРАНИЕ ПРАВОМОЧНО',
    chairman_of_the_meeting: 'Председатель собрания совета: {0} {1} {2}',
    agenda: 'ПОВЕСТКА ДНЯ',
    decision_made: 'РЕШИЛИ',
    closing_time: 'Время закрытия собрания совета: {0}.',
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета',
    chairman_of_the_council: 'Председатель совета',
    member_of_the_council: 'Член совета',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    voting: 'ГОЛОСОВАНИЕ',
    decision: '1',
    question: 'Вопрос',
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    agenda_item: '1',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    meeting_format_value: 'заочная',
    agenda_subject: 'Принять в паевой фонд паевой взнос пайщика {0} результатом интеллектуальной деятельности стоимостью {1} по Целевой Потребительской Программе «{2}» согласно поданному им Заявлению.',
    decision_text: 'Принять паевой взнос стоимостью {0} результатом интеллектуальной деятельности пайщика {1} по Целевой Потребительской Программе «{2}» (идентификатор взноса {3}), поручить Председателю Совета подписать акт приёма-передачи и учесть взнос на лицевом счёте пайщика.',
  },
}

export const exampleData = {
  meta: { created_at: '12.06.2026 12:00' },
  coop: {
    city: 'Москва',
    full_address: 'Смольная 3-84',
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
    short_name: 'ПК "Восход"',
  },
  vars: {
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
  },
  decision: {
    id: '43',
    date: '12.06.2026',
    time: '12:00',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
  },
  user: { full_name_or_short_name: 'Петров Пётр Петрович' },
  program: { name: 'ОБРАЗОВАНИЕ' },
  rid_hash: '0000abcd...',
  amount: '15000.00 RUB',
}
