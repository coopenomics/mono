/**
 * Общее для документов преподавателя по договору об участии в хозяйственной
 * деятельности (УХД) ЦПП «Образование»: приложение на курс (3007), заявление
 * (3008), протокол (3009), акт приёма-передачи (3010), акт передачи на
 * ответственное хранение (3012). Формы повторяют приложения к договору УХД
 * «Благороста» (1002, 1040–1042): каждый документ — приложение к договору,
 * называет его номер и дату, стороны подписываются с реквизитами.
 */

/** Вид результата словами: в документ идёт название, а не служебное значение. */
export const educationRidTypeLabels: Record<string, string> = {
  lesson_recording: 'Запись занятия',
  methodical_material: 'Методический материал',
  course_program: 'Программа курса',
  assessment_material: 'Оценочный материал',
  other: 'Иной результат интеллектуальной деятельности',
}

export function educationRidTypeLabel(type: string): string {
  return educationRidTypeLabels[type] ?? type
}

export const EDUCATION_DOC_STYLE = `<style>.digital-document {padding: 20px;}.digital-document h1 {margin: 0px; text-align: center;}.digital-document h3 {margin: 0px; padding-top: 15px;}.subheader {padding-bottom: 20px;}.digital-document table {width: 100%; table-layout: fixed; border-collapse: collapse; margin: 10px 0;}.digital-document th {width: 30%;}.digital-document th, .digital-document td {box-sizing: border-box; border: 1px solid currentColor; padding: 6px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; font-size: 80%;}.digital-document ul {margin: 0; padding-left: 20px;}</style>`

/** Строки «Приложение № … к Договору …» в правом верхнем углу. */
export const EDUCATION_ANNEX_HEAD_HTML = `<div style="text-align: right"><p style="margin: 0px !important">{% trans 'annex_number', rid_short_hash %}</p><p style="margin: 0px !important">{% trans 'annex_to_contract', contract_number %}</p></div>`

/** Реквизиты и подписи сторон; `user` — имя переменной пайщика в модели. */
export function educationRequisitesHtml(user: 'user' | 'common_user'): string {
  return `<p><strong>{% trans 'society' %} / {{ vars.full_abbr }} «{{ vars.name }}» /:</strong></p><p style="margin: 0px !important">{% trans 'requisites_ids', coop.details.inn, coop.details.kpp, coop.details.ogrn %}</p><p style="margin: 0px !important">{% trans 'legal_address', coop.full_address %}</p><p style="margin: 0px !important">{% trans 'contact_phone', coop.phone %}</p><p style="margin: 0px !important">{% trans 'email', coop.email %}</p><p style="margin: 0px !important">{% trans 'bank_account', coop.defaultBankAccount.account_number, coop.defaultBankAccount.bank_name, coop.defaultBankAccount.details.bik, coop.defaultBankAccount.details.corr %}</p><p style="margin: 0px !important">{% trans 'chairman_of', vars.full_abbr_genitive, vars.name %}</p><p style="margin: 0px !important">{{ coop.chairman.last_name }} {{ coop.chairman.first_name }} {{ coop.chairman.middle_name }}</p><p>{% trans 'signed_electronically' %}</p><p><strong>{% trans 'member' %}:</strong></p><p style="margin: 0px !important">{{ ${user}.full_name_or_short_name }}</p><p style="margin: 0px !important">{% trans 'contact_phone', ${user}.phone %}</p><p style="margin: 0px !important">{% trans 'email', ${user}.email %}</p><p>{% trans 'signed_electronically' %}</p>`
}

export const educationContractDocTranslations = {
  annex_number: 'Приложение № {0}',
  annex_to_contract: 'к ДОГОВОРУ об участии в хозяйственной деятельности № {0}',
  requisites_title: 'РЕКВИЗИТЫ И ПОДПИСИ СТОРОН',
  society: 'Общество',
  member: 'Пайщик',
  requisites_ids: 'ИНН {0}, КПП {1}, ОГРН {2}',
  legal_address: 'Юр. адрес: {0}',
  contact_phone: 'Контактный тел.: {0}',
  email: 'Электронная почта: {0}',
  bank_account: 'Р/с {0} в {1}, БИК {2}, Корр/счет: {3}',
  chairman_of: 'Председатель Совета {0} «{1}»',
  chairman_label: 'Председатель Совета',
  signed_electronically: 'Подписано электронной подписью.',
  row_number: '№ п/п',
  row_name: 'Наименование/Реквизиты',
  row_form: 'Форма имущества',
  row_unit: 'Ед. изм.',
  row_quantity: 'Количество',
  row_unit_price: 'Стоимость единицы',
  row_total: 'Стоимость Всего',
  total: 'ИТОГО',
  unit_piece: 'шт.',
  property_form: 'Результат интеллектуальной деятельности на цифровом носителе',
}

export const educationContractDocExample = {
  coop: {
    city: 'Москва',
    full_address: 'г. Москва, ул. Примерная, д. 1',
    phone: '+7 (900) 000-00-00',
    email: 'info@example.ru',
    details: { inn: '0000000000', kpp: '000000000', ogrn: '0000000000000' },
    defaultBankAccount: {
      account_number: '40703810000000000000',
      bank_name: 'ПАО Банк',
      details: { bik: '000000000', corr: '30101810000000000000' },
    },
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    short_abbr: 'ПК',
  },
  user: {
    full_name_or_short_name: 'Петров Пётр Петрович',
    phone: '+7 (900) 111-11-11',
    email: 'petrov@example.ru',
  },
  contract_number: 'УХД-0001',
  contract_created_at: '12.06.2026',
}
