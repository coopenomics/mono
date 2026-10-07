import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1054

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  debt_hash: string
  amount: string
  contract_date: string
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  user: ICommonUser
  short_hash: string
  contract_date: string
  amount_digits: string
  amount_words: string
}

export const title = "Заявление о возврате беспроцентного займа"
export const description = "Заявление пайщика о возврате беспроцентного займа, целиком или частью, из средств его паевого взноса на главном кошельке"

export const context = "<div class=\"digital-document\"><div style=\"text-align: right\"><p>В Совет {{vars.full_abbr_genitive}} «{{vars.name}}»</p><p>от пайщика {{user.full_name_or_short_name}}</p></div><h2 style=\"text-align: center\">ЗАЯВЛЕНИЕ о возврате беспроцентного займа</h2><p>Прошу принять в счёт возврата беспроцентного займа по Договору о беспроцентном займе № {{short_hash}} от {{contract_date}} сумму {{amount_digits}} ({{amount_words}}) из средств моего паевого взноса, учитываемых в целевой потребительской программе «Цифровой Кошелёк», и уменьшить мою задолженность по указанному Договору на эту сумму.</p><p>{{created_at}}. Пайщик {{user.full_name_or_short_name}}. Подписано электронной подписью.</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;} .digital-document p {margin: 0 0 8px 0;} .digital-document h3 {margin: 16px 0 8px 0;}</style>"

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
  "contract_date": "07.10.2026",
  "amount_digits": "10 000,00",
  "amount_words": "десять тысяч рублей 00 копеек"
}
