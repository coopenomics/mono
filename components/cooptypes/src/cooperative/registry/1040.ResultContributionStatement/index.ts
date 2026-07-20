import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1040

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
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

export const title = 'Заявление о взносе результата интеллектуальной деятельности'
export const description = 'Заявление о внесении паевого взноса результата интеллектуальной деятельности'

export const context = `<div class="digital-document"><div style="text-align: right"><p>{% trans 'appendix_title' %} № {{ result_short_hash }}</p><p>{% trans 'to_agreement' %} № {{ contributor_contract_number }}</p><p>{% trans 'to_council' %} {{ vars.full_abbr_genitive }} "{{ vars.name }}"</p><p>{% trans 'from_shareholder' %} {{ common_user.full_name_or_short_name }}</p></div><div style="text-align: center"><h2>{% trans 'statement_title' %} № ЗПВИ - {{ result_short_hash }}</h2></div><p>{% trans 'statement_text' %} № {{ contributor_contract_number }} {% trans 'from_date' %} {{ contributor_contract_created_at }} {% trans 'and_appendix' %} №{{ blagorost_agreement_number }} {% trans 'from_date' %} {{ blagorost_agreement_created_at }} {% trans 'blagorost_agreement_text' %}, {% trans 'request_contribution' %}:</p><table><tr><th>{% trans 'property_name' %}</th><td>{% trans 'share_contribution' %} "{{ project_name }}" {% trans 'component' %} "{{ component_name }}"</td></tr><tr><th>{% trans 'property_form' %}</th><td>{% trans 'property_form_text' %} {{ percent_of_result }}% {% trans 'in_copyright_object' %} № {{ contributor_contract_number }}</td></tr><tr><th>{% trans 'description' %}</th><td>{% trans 'description_text' %} {{ percent_of_result }}% {% trans 'in_copyright_object_short' %}, {% trans 'namely' %} c9s://{{ result_hash }}</td></tr><tr><th>{% trans 'purpose' %}</th><td>{% trans 'purpose_text' %} № {{ contributor_contract_number }}</td></tr><tr><th>{% trans 'other_characteristics' %}</th><td>{% trans 'other_characteristics_text' %} №{{ result_hash }}.</td></tr></table><table><tr><th>{% trans 'number_pp' %}</th><td>1</td></tr><tr><th>{% trans 'name_details' %}</th><td>{% trans 'property_description' %} {{ percent_of_result }}% {% trans 'in_copyright_object_short' %}</td></tr><tr><th>{% trans 'unit' %}</th><td>{% trans 'share' %}</td></tr><tr><th>{% trans 'quantity' %}</th><td>{{ percent_of_result }}%</td></tr><tr><th>{% trans 'total_cost' %}</th><td>{{ total_amount }}</td></tr><tr style="font-weight: bold;"><th>{% trans 'total' %}</th><td>{{ percent_of_result }}% / {{ total_amount }}</td></tr></table><p>{% trans 'property_confirmation' %}.</p><p>{% trans 'shareholder' %}: {{ common_user.full_name_or_short_name }}</p><p>{{ meta.created_at }}</p><p>{% trans 'signed_by_digital_signature' %}</p><p style="margin-top: 30px;">{% trans 'accepted' %}</p><p>{% trans 'signed_by_digital_signature' %}</p><p>{% trans 'chairman_title' %}</p><p>{{ vars.short_abbr }} "{{ vars.name }}"</p><p>{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}table {width: 100%;border-collapse: collapse;margin-top: 20px;}th, td {border: 1px solid #ccc;padding: 8px;text-align: left;word-wrap: break-word;overflow-wrap: break-word;word-break: break-all;vertical-align: top;}th {background-color: #f4f4f4;width: 30%;font-weight: bold;}</style>`

export const translations = {
  ru: {
    appendix_title: 'Приложение',
    to_agreement: 'к ДОГОВОРУ об участии в хозяйственной деятельности',
    to_council: 'В Совет',
    from_shareholder: 'от Пайщика',
    statement_title: 'ЗАЯВЛЕНИЕ',
    statement_text: 'В соответствии с условиями Договора об участии в хозяйственной деятельности',
    from_date: 'от',
    and_appendix: 'и его Приложением',
    blagorost_agreement_text: 'о соглашении по присоединению к целевой потребительской программе "БЛАГОРОСТ"',
    request_contribution: 'прошу принять от меня Паевой взнос в Общество следующим Имуществом',
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
    property_confirmation: 'Я подтверждаю, что Имущество, которые я вношу паевым взносом в Общество, принадлежат мне на праве собственности, в споре и под арестом не состоят',
    shareholder: 'Пайщик',
    signed_by_digital_signature: 'Подписано электронной подписью',
    accepted: 'ПРИНЯТО',
    chairman_title: 'Председатель Совета',
  },
}

export const exampleData = {
  meta: {
    created_at: '11.04.2024 12:00',
  },
  contributor_contract_number: 'ED3BCFC5B681AA83D',
  contributor_contract_created_at: '11.04.2024',
  blagorost_agreement_number: 'ed3bcfd5b681aa83d395',
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
    short_abbr: 'ПК',
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
    email: 'ivanov@example.com',
    phone: '+7 999 123-45-67',
  },
  coop: {
    short_name: 'ПК "ВОСХОД"',
    details: {
      inn: '9728130611',
      kpp: '772801001',
      ogrn: '1247700283346',
    },
    full_address: '117593, г. МОСКВА, ВН.ТЕР.Г. МУНИЦИПАЛЬНЫЙ ОКРУГ ЯСЕНЕВО, ПРОЕЗД СОЛОВЬИНЫЙ, Д. 1, ПОМЕЩ. 1/1',
    phone: '+7 900 000-00-01',
    email: 'chairman@example.com',
    defaultBankAccount: {
      currency: 'RUB',
      bank_name: 'ПАО Сбербанк',
      account_number: '40703810038000110117',
      details: {
        bik: '044525225',
        corr: '30101810400000000225',
      },
    },
    chairman: {
      first_name: 'Алексей',
      last_name: 'Муравьев',
      middle_name: 'Николаевич',
    },
    city: 'г. Москва',
  },
}
