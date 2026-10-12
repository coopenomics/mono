import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1057

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  debt_hash: string
  amount: string
  due_at: string
  basis_type: 'uhd' | 'offer'
  program_name?: string
  collateral: string
  decision_id: number
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
  decision_number: string
  decision_date: string
}

export const title = "Акт приёма-передачи имущественного права в залог"
export const description = "Акт о передаче пайщиком кооперативу имущественного права на возврат части паевого взноса в залог по договору о беспроцентном займе; подписывают председатель совета и пайщик"

export const context = "<div class=\"digital-document\"><div style=\"text-align: right\"><p>ПРИЛОЖЕНИЕ № {{short_hash}}</p><p>к {{basis_title_dative}} № {{basis_number}}</p></div><h2 style=\"text-align: center\">АКТ № АПИПЗ-{{short_hash}}</h2><p>г. {{coop.city}}</p><p>Дата: {{created_at}}</p><p>{{vars.full_abbr}} «{{vars.name}}» (далее “Общество”) в лице Председателя Совета Общества {{coop.chairman.first_name}} {{coop.chairman.middle_name}} {{coop.chairman.last_name}}, и Пайщик {{user.full_name_or_short_name}}, составили настоящий Акт о том, что Пайщик передал, а Кооператив получил от Пайщика, в соответствии с условиями Договора залога Имущественного права, являющегося Приложением № {{short_hash}} к {{basis_title_dative}} № {{basis_number}} от {{basis_date}} и Протоколом Совета № {{decision_number}} от {{decision_date}} Имущественное право по возврату части Паевого взноса Пайщика стоимостью {{amount_digits}}.</p><p>Претензий по качеству Имущества Общество не имеет.</p><p>ПЕРЕДАНО: Пайщик {{user.full_name_or_short_name}}. Подписано электронной подписью</p><p>ПОЛУЧЕНО: Председатель Совета {{coop.chairman.last_name}} {{coop.chairman.first_name}} {{coop.chairman.middle_name}}. Подписано электронной подписью</p></div><style>.digital-document {padding: 20px;white-space: pre-wrap;} .digital-document p {margin: 0 0 8px 0;} .digital-document h2 {margin: 16px 0 8px 0;} .digital-document h3 {margin: 16px 0 8px 0;}</style>"

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
  "amount_digits": "30 000,00 RUB",
  "decision_number": "12",
  "decision_date": "08.10.2026"
}
