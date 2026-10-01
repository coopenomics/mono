/**
 * Общее для документов преподавателя по договору об участии в хозяйственной
 * деятельности (УХД) ЦПП «Образование»: заявление (3008), протокол (3009),
 * акт приёма-передачи (3010), акт передачи на ответственное хранение (3012).
 * Формы повторяют приложения к договору УХД «Благороста» (1040–1042): каждый
 * документ называет номер и дату договора.
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

export const educationContractDocTranslations = {
  annex_number: 'Приложение № {0}',
  annex_to_contract: 'к ДОГОВОРУ об участии в хозяйственной деятельности № {0}',
  member: 'Пайщик',
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
