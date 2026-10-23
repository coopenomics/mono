import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IDecisionData, IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1042

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  result_act_hash: string
  percent_of_result: string
  total_amount: string
  decision_id: number
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
  result_act_hash: string
  result_act_short_hash: string
  result_hash: string
  percent_of_result: string
  total_amount: string
}

export const title = 'Акт приема-передачи результата интеллектуальной деятельности'
export const description = 'Форма акта приема-передачи результата интеллектуальной деятельности'

export const context = `<div class="digital-document"><div style="text-align: right"><p>{% trans 'appendix_number' %} {{ result_act_short_hash }}</p><p>{% trans 'appendix_to_agreement' %} № {{ contributor_contract_number }}</p></div><div style="text-align: center"><h2>{% trans 'act_title' %} № АППИ-{{ result_act_short_hash }}</h2></div><div style="display: flex; justify-content: space-between;"><p>{% trans 'city_label' %} {{ coop.city }}</p><p>{% trans 'date_label' %} {{ created_at }}</p></div><p>{{ vars.full_abbr }} "{{ vars.name }}" {% trans 'hereinafter_society' %} {% trans 'in_face_of_chairman' %} {{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}, {% trans 'and_shareholder' %} {{ common_user.full_name_or_short_name }}, {% trans 'act_text' %} № {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }} {% trans 'and_appendix' %} №{{ blagorost_agreement_number }} {% trans 'from_date' %} {{ blagorost_agreement_created_at }} {% trans 'blagorost_program_text' %} {% trans 'and_protocol' %} № {{ decision.id }} {% trans 'from_date' %} {{ decision.date }} {% trans 'following_property' %}:</p><table><tr><th>{% trans 'number_pp' %}</th><td>1</td></tr><tr><th>{% trans 'name_details' %}</th><td>{% trans 'copyright_object_description' %} {{ percent_of_result }}% {% trans 'in_copyright_object_short' %}, {% trans 'namely' %} №{{ result_hash }}.</td></tr><tr><th>{% trans 'property_form' %}</th><td>{% trans 'copyright_right_description', percent_of_result, contributor_contract_number %}</td></tr><tr><th>{% trans 'unit' %}</th><td>{% trans 'share' %}</td></tr><tr><th>{% trans 'quantity' %}</th><td>{{ percent_of_result }}%</td></tr><tr><th>{% trans 'total_cost' %}</th><td>{{ total_amount }}</td></tr><tr style="font-weight: bold;"><th>{% trans 'total' %}</th><td>{{ percent_of_result }}% / {{ total_amount }}</td></tr></table><p>{% trans 'no_claims_quality' %}.</p><div style="margin-top: 40px;"><p><strong>{% trans 'transferred' %}:</strong></p><p>{% trans 'shareholder' %}: {{ common_user.full_name_or_short_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div><div style="margin-top: 40px;"><p><strong>{% trans 'received' %}:</strong></p><p>{% trans 'chairman_title' %}</p><p>{{ vars.short_abbr }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_by_digital_signature' %}</p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;margin-top: 20px;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word;overflow-wrap: break-word;word-break: break-all;vertical-align: top;}th {background-color: #f4f4f4;width: 30%;font-weight: bold;}</style>`

export const translations = {
  ru: {
    act_title: 'АКТ',
    appendix_number: 'Приложение №',
    appendix_to_agreement: 'к ДОГОВОРУ об участии в хозяйственной деятельности',
    city_label: 'г.',
    date_label: 'Дата:',
    hereinafter_society: '(далее "Общество")',
    in_face_of_chairman: 'в лице Председателя Совета Общества',
    and_shareholder: 'и Пайщик',
    act_text: 'составили настоящий Акт о том, что Пайщик передал, а Кооператив получил от Пайщика, в соответствии с условиями Договора об участии в хозяйственной деятельности',
    from_date: 'от',
    and_appendix: 'и его Приложением',
    blagorost_program_text: 'о соглашении по присоединению к целевой потребительской программе "БЛАГОРОСТ"',
    and_protocol: 'и Протоколом Совета',
    following_property: 'следующее Имущество',
    number_pp: '№ п/п',
    name_details: 'Наименование/Реквизиты',
    property_form: 'Форма имущества',
    unit: 'Ед. изм.',
    quantity: 'Количество',
    total_cost: 'Стоимость Всего',
    copyright_object_description: 'Объект Авторских Прав (ОАП) Пайщика, а именно: исключительное право на долю',
    in_copyright_object_short: 'в ОАП',
    namely: 'запись на электронном носителе (репозитории Общества)',
    copyright_right_description: 'Исключительное право на долю {0}% в ОАП в соответствии с пунктом 2.1. Договора об участии в хозяйственной деятельности №{1}',
    share: 'доля',
    total: 'ИТОГО',
    no_claims_quality: 'Претензий по качеству Имущества Общество не имеет',
    transferred: 'ПЕРЕДАНО',
    shareholder: 'Пайщик',
    signed_by_digital_signature: 'Подписано электронной подписью',
    received: 'ПОЛУЧЕНО',
    chairman_title: 'Председатель Совета',
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
  result_act_short_hash: 'ACT1234567890ABCDEF',
  result_hash: 'R3S4ULT5678901234567890',
  percent_of_result: '25.00000000',
  total_amount: '50000.00 RUB',
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский кооператив',
    short_abbr: 'ПК',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  coop: {
    city: 'Москва',
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
  },
  decision: {
    date: '11.04.2024',
    id: '1',
  },
}
