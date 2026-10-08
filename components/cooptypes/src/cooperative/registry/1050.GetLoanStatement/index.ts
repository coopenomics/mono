import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1050

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  debt_hash: string
  amount: string
  due_at: string
  basis_type: 'uhd' | 'offer'
  program_name?: string
  method_id: string
  collateral?: string
  storage_appendix_number?: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  short_hash: string
  basis_title_dative: string
  basis_title_genitive: string
  basis_title_instrumental: string
  basis_number: string
  basis_date: string
  amount_digits: string
  amount_words: string
  due_at: string
  payment_details: string
  collateral_text: string
}

export const title = "Заявление на получение беспроцентного займа"
export const description = "Заявление пайщика о выдаче беспроцентного займа с указанием обеспечения: имущество на ответственном хранении (Генерация) либо право на возврат части паевого взноса в целевой программе"

export const context = "<div class=\"digital-document\"><div style=\"text-align: right\"><p>Приложение № {{short_hash}}</p><p>к {{basis_title_dative}} № {{basis_number}} от {{basis_date}}</p><p>В Совет {{vars.full_abbr_genitive}} «{{vars.name}}»<br>от пайщика {{user.full_name_or_short_name}}</p></div><h2 style=\"text-align: center\">ЗАЯВЛЕНИЕ</h2><p>В соответствии с условиями {{basis_title_genitive}} № {{basis_number}} от {{basis_date}} прошу начислить на мой лицевой счёт в целевой потребительской программе «Цифровой Кошелёк» сумму {{amount_digits}} ({{amount_words}}) для выдачи мне беспроцентного займа в указанном размере по следующим реквизитам:</p><p>{{payment_details}}</p><p>Обязуюсь произвести возврат полученных средств до {{due_at}}.</p><p>В качестве обеспечения займа прошу принять от меня {{collateral_text}}.</p><p>{{created_at}}. Пайщик {{user.full_name_or_short_name}}. Подписано электронной подписью.</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;} .digital-document p {margin: 0 0 8px 0;} .digital-document h3 {margin: 16px 0 8px 0;}</style>"

export const translations = {
  ru: {
    signed_by_digital_signature: 'Подписано электронной подписью',
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
    }
  },
  "vars": {
    "name": "ВОСХОД",
    "full_abbr": "Потребительский Кооператив",
    "full_abbr_genitive": "Потребительского Кооператива",
    "full_abbr_dative": "Потребительскому Кооперативу"
  },
  "user": {
    "full_name_or_short_name": "Иванов Иван Иванович",
    "abbr_full_name": "Иванов И.И.",
    "email": "ivanov@example.com",
    "phone": "+7 999 123-45-67"
  },
  "short_hash": "A1B2C3D4",
  "basis_title_dative": "Договору об участии в хозяйственной деятельности",
  "basis_title_genitive": "Договора об участии в хозяйственной деятельности",
  "basis_title_instrumental": "Договором об участии в хозяйственной деятельности",
  "basis_number": "ED3BCFC5B681AA83D",
  "basis_date": "11.04.2026",
  "amount_digits": "30 000,00",
  "amount_words": "тридцать тысяч рублей 00 копеек",
  "due_at": "07.04.2027",
  "payment_details": "№ счета получателя: 40817810000000000001\nБанк получателя: ПАО Сбербанк\nБИК: 044525225",
  "collateral_text": "имущественное право на возврат части паевого взноса по целевой потребительской программе «Благорост»"
}
