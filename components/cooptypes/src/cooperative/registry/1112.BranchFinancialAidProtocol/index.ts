import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1112

/**
 * Протокол совета о выплате материальной помощи доверенному лицу
 * кооперативного участка (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Документ-Решение совета по Заявлению на выплату материальной помощи
 * (registry 1109). Подписывается председателем после голосования через
 * стандартный sov.decision-flow (`soviet::authorize` с этим документом в
 * качестве `authorization`). `soviet::exec` запускает callback
 * `branch::onaidauth(coopname, hash, authorization)`, который сохраняет
 * этот Протокол в `aids.protocol`, переводит заявление в AUTHORIZED и
 * регистрирует исходящий платёж в gateway — заявка попадает к кассиру.
 *
 * Материальная помощь выводит средства из кооператива, поэтому решение о
 * ней принимает совет, а не сам получатель: распределение средств на
 * персональный кошелёк участника такого решения не заменяет.
 */
export interface Action extends IGenerate {
  registry_id: number
  /** ID решения в soviet.decisions (auto-increment на цепи). */
  decision_id: number
  /** Канонический идентификатор заявления on-chain (якорь к aids.hash). */
  aid_hash: string
  /** Аккаунт получателя материальной помощи — доверенного/председателя участка. */
  receiver: string
  /** Кооперативный участок, средства которого распределены получателю. */
  braname: string
  /** Сумма выплаты (4 знака после запятой, валюта `_root_govern_symbol`). */
  amount: string
}

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  aid_hash: string
  receiver: ICommonUser
  braname: string
  amount: string
}

export const title = 'Протокол совета о выплате материальной помощи'
export const description = 'Форма протокола решения совета о выплате материальной помощи доверенному лицу кооперативного участка из распределённых ему членских взносов'

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
        <td>{% trans 'agenda_subject', receiver.full_name_or_short_name, amount, braname %}</td>
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
        <td>{% trans 'decision_aid_text', amount, receiver.full_name_or_short_name, braname %}</td>
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
    agenda_subject: 'Утвердить выплату материальной помощи пайщику {0} в размере {1} из числа членских взносов кооперативного участка «{2}», распределённых ему по условиям участка, — поданное им Заявление на выплату материальной помощи.',
    decision_aid_text: 'Выплатить материальную помощь в размере {0} пайщику {1} с расчётного счёта кооператива на указанные им реквизиты, списав сумму с персонального кошелька членских средств получателя по кооперативному участку «{2}». Кооператив как налоговый агент удерживает из указанной суммы налог на доходы физических лиц по ставке 13 %, перечисляет получателю сумму за вычетом удержанного налога и уплачивает удержанный налог в бюджет.',
  },
}

export const exampleData = {
  meta: { created_at: '07.06.2026 12:00' },
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
    date: '07.06.2026',
    time: '12:00',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
  },
  aid_hash: '0000abcd...',
  receiver: { full_name_or_short_name: 'Иванов Иван Иванович' },
  braname: 'KU-MOSKVA-1',
  amount: '5000.0000 RUB',
}
