import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1041

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  decision_id: number
  project_name: string
  component_name: string
  result_hash: string
  percent_of_result: string
  total_amount: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  decision: IDecisionData
  common_user: ICommonUser
  contributor_contract_number: string
  contributor_contract_created_at: string
  blagorost_agreement_number: string
  blagorost_agreement_created_at: string
  project_name: string
  component_name: string
  result_hash: string
  result_short_hash: string
  percent_of_result: string
  total_amount: string
}

export const title = 'Протокол решения совета о приеме паевого взноса результатом интеллектуальной деятельности'
export const description = 'Форма протокола решения совета о приеме паевого взноса результатом интеллектуальной деятельности'

export const context = `<style>h1 {margin: 0px;text-align:center;}h3{margin: 0px;padding-top: 15px;}.about {padding: 20px;}.about p{margin: 0px;}.signature {padding-top: 20px;}.digital-document {padding: 20px;white-space: pre-wrap;}.subheader {padding-bottom: 20px;}table {width: 100%;border-collapse: collapse;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word;overflow-wrap: break-word;word-break: break-all;}th {background-color: #f4f4f4;width: 30%;font-weight: bold;}.property-table {margin-top: 20px;}.property-table th {width: auto;}</style><div class="digital-document"><h1 class="header">{% trans 'protocol_number', decision.id %}</h1><p style="text-align:center" class="subheader">{% trans 'council_meeting_name' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p style="text-align: right"> {{ meta.created_at }}, {{ coop.city }}</p><table class="about"><tbody><tr><th>{% trans 'meeting_format' %}</th><td>{% trans 'meeting_format_value' %}</td></tr><tr><th>{% trans 'meeting_place' %}</th><td>{{ coop.full_address }}</td></tr><tr><th>{% trans 'meeting_date' %}</th><td>{{ decision.date }}</td></tr><tr><th>{% trans 'opening_time' %}</th><td>{{ decision.time }}</td></tr></tbody></table><h3>{% trans 'council_members' %}</h3><table><tbody>{% for member in coop.members %}<tr><th>{% if member.is_chairman %}{% trans 'chairman_of_the_council' %}{% else %}{% trans 'member_of_the_council' %}{% endif %}</th><td>{{ member.last_name }} {{ member.first_name }} {{ member.middle_name }}</td></tr>{% endfor %}</tbody></table><h3>{% trans 'meeting_legality' %}</h3><p>{% trans 'voting_results', decision.voters_percent %} {% trans 'quorum' %} {% trans 'chairman_of_the_meeting', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name %}.</p><h3>{% trans 'agenda' %}</h3><table><tbody><tr><th>№</th><td>{% trans 'question' %}</td></tr><tr><th>1</th><td>{% trans 'agenda_text', common_user.full_name_or_short_name, result_short_hash, contributor_contract_number, contributor_contract_created_at, blagorost_agreement_number, blagorost_agreement_created_at %}</td></tr></tbody></table><h3>{% trans 'hearing' %}</h3><p>{% trans 'hearing_text', coop.chairman.last_name, coop.chairman.first_name, coop.chairman.middle_name, common_user.full_name_or_short_name, result_short_hash, contributor_contract_number, contributor_contract_created_at, blagorost_agreement_number, blagorost_agreement_created_at %}.</p><h3>{% trans 'voting' %}</h3><p>{% trans 'vote_results' %}</p><table><tbody><tr><th>{% trans 'votes_for' %}</th><td>{{ decision.votes_for }}</td></tr><tr><th>{% trans 'votes_against' %}</th><td>{{ decision.votes_against }}</td></tr><tr><th>{% trans 'votes_abstained' %}</th><td>{{ decision.votes_abstained }}</td></tr></tbody></table><h3>{% trans 'decision_made' %}</h3><p>1. {% trans 'decision_text_simple', common_user.full_name_or_short_name, result_short_hash, contributor_contract_number, contributor_contract_created_at, blagorost_agreement_number, blagorost_agreement_created_at %}</p><table class="property-table"><tr><th>{% trans 'property_name' %}</th><td>{% trans 'share_contribution' %} "{{ project_name }}" {% trans 'component' %} "{{ component_name }}"</td></tr><tr><th>{% trans 'property_form' %}</th><td>{% trans 'property_form_text' %} {{ percent_of_result }}% {% trans 'in_copyright_object' %} № {{ contributor_contract_number }}</td></tr><tr><th>{% trans 'description' %}</th><td>{% trans 'description_text' %} {{ percent_of_result }}% {% trans 'in_copyright_object_short' %}, {% trans 'namely' %} c9s://{{ result_hash }}</td></tr><tr><th>{% trans 'purpose' %}</th><td>{% trans 'purpose_text' %} № {{ contributor_contract_number }}</td></tr><tr><th>{% trans 'other_characteristics' %}</th><td>{% trans 'other_characteristics_text' %} №{{ result_hash }}.</td></tr></table><table class="property-table"><tr><th>{% trans 'number_pp' %}</th><td>1</td></tr><tr><th>{% trans 'name_details' %}</th><td>{% trans 'property_description' %} {{ percent_of_result }}% {% trans 'in_copyright_object_short' %}</td></tr><tr><th>{% trans 'unit' %}</th><td>{% trans 'share' %}</td></tr><tr><th>{% trans 'quantity' %}</th><td>{{ percent_of_result }}%</td></tr><tr><th>{% trans 'total_cost' %}</th><td>{{ total_amount }}</td></tr><tr style="font-weight: bold;"><th>{% trans 'total' %}</th><td>{{ percent_of_result }}% / {{ total_amount }}</td></tr></table><hr><p>{% trans 'closing_time', decision.time %}</p><div class="signature"><p>{% trans 'signature' %}</p><p>{% trans 'chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div></div>`

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
    vote_results: 'По первому вопросу повестки дня проголосовали:',
    decision_made: 'РЕШИЛИ',
    closing_time: 'Время закрытия собрания совета: {0}.',
    protocol_number: 'ПРОТОКОЛ № {0}',
    council_meeting_name: 'Собрания Совета',
    chairman_of_the_council: 'Председатель совета',
    signature: 'Документ подписан электронной подписью.',
    chairman: 'Председатель',
    quorum: 'Кворум для решения поставленных на повестку дня вопросов имеется.',
    voting: 'ГОЛОСОВАНИЕ',
    meeting_format_value: 'Заочная',
    member_of_the_council: 'Член совета',
    question: 'Вопрос',
    votes_for: 'ЗА',
    votes_against: 'ПРОТИВ',
    votes_abstained: 'ВОЗДЕРЖАЛСЯ',
    hearing: 'СЛУШАЛИ',
    agenda_text: 'Заявление пайщика {0} № ЗПВИ-{1} на внесение паевого взноса Имуществом в соответствии с условиями Договора об участии в хозяйственной деятельности № {2} от {3} и его Приложением №{4} от {5} о соглашении по присоединению к целевой потребительской программе "БЛАГОРОСТ".',
    hearing_text: '{0} {1} {2} с предложением принять паевой взнос Имуществом от пайщика {3} согласно его заявления № ЗПВИ-{4} в соответствии с условиями Договора об участии в хозяйственной деятельности № {5} от {6} и его Приложением №{7} от {8} о соглашении по присоединению к целевой потребительской программе "БЛАГОРОСТ". Пайщик {3} подтверждает, что заявленное к взносу Имущество принадлежит ему на праве собственности, в споре и под арестом не состоит',
    decision_text_simple: 'Принять паевой взнос Имуществом от пайщика {0} согласно его заявления № ЗПВИ-{1} в соответствии с условиями Договора об участии в хозяйственной деятельности № {2} от {3} и его Приложением №{4} от {5} о соглашении по присоединению к целевой потребительской программе "БЛАГОРОСТ"',
    property_name: 'Наименование/ название',
    share_contribution: 'Паевой взнос - ПО Проект',
    component: 'Компонент',
    property_form: 'Форма Имущества',
    property_form_text: 'Исключительное право на долю',
    in_copyright_object: 'в Объекте Авторских Прав (ОАП) в соответствии с пунктом 2.1. Договора об участии в хозяйственной деятельности',
    description: 'Описание',
    description_text: 'Овеществленные (на бумажных и/или цифровых носителях) и выраженные в денежной исключительное право на долю',
    in_copyright_object_short: 'в ОАП',
    namely: 'а именно',
    purpose: 'Назначение',
    purpose_text: 'В целях реализации Предмета Договора об участии в хозяйственной деятельности',
    other_characteristics: 'Прочие характеристики и описание',
    other_characteristics_text: 'запись на электронном носителе (репозитории Общества)',
    number_pp: '№ п/п',
    name_details: 'Наименование/Реквизиты',
    unit: 'Ед. изм.',
    quantity: 'Количество',
    total_cost: 'Стоимость Всего',
    property_description: 'Имущество - исключительное право на долю',
    share: 'доля',
    total: 'ИТОГО',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  contributor_contract_number: 'ED3BCFC5B681AA83D',
  contributor_contract_created_at: '11.04.2024',
  blagorost_agreement_number: 'ed3bcfd5b681aa83d',
  blagorost_agreement_created_at: '11.04.2024',
  project_name: 'Проект цифровой платформы',
  component_name: 'Компонент разработки',
  result_hash: 'R3S4ULT5678901234567890',
  result_short_hash: 'R3S4ULT5678901234567890',
  percent_of_result: '25.00000000',
  total_amount: '50000.00 RUB',
  vars: {
    name: 'ВОСХОД',
    full_abbr_genitive: 'Потребительского Кооператива',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  coop: {
    full_address: '117593, г. МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ ЯСЕНЕВО, ПРОЕЗД СОЛОВЬИНЫЙ, Д. 1, ПОМЕЩ. 1/1',
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
    city: 'Москва',
  },
  decision: {
    time: '12:00',
    date: '11.04.2024',
    votes_for: '3',
    votes_against: '0',
    votes_abstained: '0',
    voters_percent: '100',
    id: '1',
  },
  member: {
    is_chairman: '',
    last_name: '',
    first_name: '',
    middle_name: '',
  },
}
