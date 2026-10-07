import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1051

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  decision_id: number
  debt_hash: string
  amount: string
  due_at: string
  basis_type: 'uhd' | 'offer'
  program_name?: string
  collateral?: string
  storage_appendix_number?: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  common_user: ICommonUser
  short_hash: string
  basis_title_instrumental: string
  basis_number: string
  basis_date: string
  amount_digits: string
  amount_words: string
  due_at: string
  collateral_text: string
}

export const title = 'Протокол решения совета о предоставлении беспроцентного займа'
export const description = 'Форма протокола решения совета о предоставлении пайщику беспроцентного займа по его заявлению'

export const context = "<style>h1 {margin: 0px;text-align:center;}h3{margin: 0px;padding-top: 15px;}.about {padding: 20px;}.about p{margin: 0px;}.signature {padding-top: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word;overflow-wrap: break-word;word-break: break-all;}th {background-color: #f4f4f4;width: 30%;font-weight: bold;}.property-table {margin-top: 20px;}.property-table th {width: auto;}</style><div class=\"digital-document\"><h1 class=\"header\">{% trans 'protocol_number', decision.id %}</h1><p style=\"text-align:center\" class=\"subheader\">{% trans 'council_meeting_name' %} {{ vars.full_abbr_genitive }} \"{{ vars.name }}\"</p><p style=\"text-align: right\"> {{ created_at }}, {{ coop.city }}</p><table class=\"about\"><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3>{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><h3>{% trans 'meeting_legality' %}</h3><p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p><h3>{% trans 'agenda' %}</h3><table><tbody><tr><th>№</th><td>{% trans 'question' %}</td></tr><tr><th>1</th><td>{% trans 'agenda_text', common_user.full_name_or_short_name, short_hash, amount_digits, amount_words, due_at, collateral_text, basis_title_instrumental, basis_number, basis_date %}</td></tr></tbody></table><h3>{% trans 'hearing' %}</h3><p>{% trans 'hearing_text', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name, short_hash %}.</p><h3>{% trans 'voting' %}</h3><p>{% trans 'vote_results' %}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ decision.votes_for }}</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ decision.votes_against }}</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ decision.votes_abstained }}</td></tr></tbody></table><h3>{% trans 'decision_made' %}</h3><p>1. {% trans 'decision_text', common_user.full_name_or_short_name, amount_digits, amount_words, due_at, collateral_text, short_hash %}</p><p>2. {% trans 'decision_text_2' %}</p><p>{% trans 'closing_time', decision.time %}</p><div class=\"signature\"><p>{% trans 'chairman_of_the_council' %} {{ vars.full_abbr_genitive }} \"{{ vars.name }}\" {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signature' %}</p></div></div>"

export const translations = {
  ru: {
    'meeting_format': 'Форма',
    'meeting_date': 'Дата',
    'meeting_place': 'Место',
    'opening_time': 'Время открытия',
    'council_members': 'ЧЛЕНЫ СОВЕТА',
    'voting_results': 'Количество голосов составляет {0}% от общего числа членов Совета.',
    'meeting_legality': 'СОБРАНИЕ ПРАВОМОЧНО',
    'chairman_of_the_meeting': 'Председатель собрания совета: {0} {1} {2}',
    'agenda': 'ПОВЕСТКА ДНЯ',
    'vote_results': 'По первому вопросу повестки дня проголосовали:',
    'decision_made': 'РЕШИЛИ',
    'closing_time': 'Время закрытия собрания совета: {0}.',
    'protocol_number': 'ПРОТОКОЛ № {0}',
    'council_meeting_name': 'Собрания Совета',
    'chairman_of_the_council': 'Председатель совета',
    'signature': 'Документ подписан электронной подписью.',
    'quorum': 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    'voting': 'ГОЛОСОВАНИЕ',
    'meeting_format_value': 'Заочная',
    'member_of_the_council': 'Член совета',
    'question': 'Вопрос',
    'votes_for': 'ЗА',
    'votes_against': 'ПРОТИВ',
    'votes_abstained': 'ВОЗДЕРЖАЛСЯ',
    'hearing': 'СЛУШАЛИ',
    'agenda_text': 'Заявление пайщика {0} № {1} о предоставлении беспроцентного займа в сумме {2} ({3}) на срок до {4} под обеспечение: {5}, в соответствии с {6} № {7} от {8}.',
    'hearing_text': '{0} {1} {2} с предложением предоставить пайщику {3} беспроцентный заём согласно его заявлению № {4} и заключить с ним договор о беспроцентном займе',
    'decision_text': 'Предоставить пайщику {0} беспроцентный заём в сумме {1} ({2}) на срок до {3} под обеспечение: {4}, и заключить с ним договор о беспроцентном займе № {5}.',
    'decision_text_2': 'Поручить Председателю Совета подписать договор о беспроцентном займе и обеспечить перечисление суммы займа пайщику по указанным им реквизитам.'
},
}

export const exampleData = {
  "meta": {
    "created_at": "07.10.2026 12:00"
  },
  "coop": {
    "short_name": "ПК «ВОСХОД»",
    "city": "Москва",
    "full_address": "117593, г. Москва, проезд Соловьиный, д. 1, помещ. 1/1",
    "phone": "+7 900 000-00-01",
    "email": "chairman@example.com",
    "details": {
      "inn": "9728130611",
      "kpp": "772801001",
      "ogrn": "1247700283346"
    },
    "defaultBankAccount": {
      "currency": "RUB",
      "bank_name": "ПАО Сбербанк",
      "account_number": "40703810038000110117",
      "details": {
        "bik": "044525225",
        "corr": "30101810400000000225"
      }
    },
    "chairman": {
      "first_name": "Алексей",
      "last_name": "Муравьев",
      "middle_name": "Николаевич"
    },
    "members": [
      {
        "first_name": "Алексей",
        "last_name": "Муравьев",
        "middle_name": "Николаевич",
        "is_chairman": true
      }
    ]
  },
  "vars": {
    "name": "ВОСХОД",
    "full_abbr": "Потребительский Кооператив",
    "full_abbr_genitive": "Потребительского Кооператива",
    "full_abbr_dative": "Потребительскому Кооперативу"
  },
  "decision": {
    "id": 1,
    "date": "07.10.2026",
    "time": "12:00",
    "votes_for": 3,
    "votes_against": 0,
    "votes_abstained": 0,
    "voters_percent": 100
  },
  "common_user": {
    "full_name_or_short_name": "Иванов Иван Иванович",
    "abbr_full_name": "Иванов И.И.",
    "email": "ivanov@example.com",
    "phone": "+7 999 123-45-67"
  },
  "short_hash": "A1B2C3D4",
  "basis_title_instrumental": "Договором об участии в хозяйственной деятельности",
  "basis_number": "ED3BCFC5B681AA83D",
  "basis_date": "11.04.2026",
  "amount_digits": "30 000,00",
  "amount_words": "тридцать тысяч рублей 00 копеек",
  "due_at": "07.04.2027",
  "collateral_text": "имущественное право на возврат части паевого взноса по целевой потребительской программе «Благорост»"
}
