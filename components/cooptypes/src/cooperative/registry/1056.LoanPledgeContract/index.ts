import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1056

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
  debt_hash: string
  amount: string
  due_at: string
  basis_type: 'uhd' | 'offer'
  program_name?: string
  collateral: string
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
  basis_title_dative: string
  basis_title_genitive: string
  basis_title_instrumental: string
  basis_number: string
  basis_date: string
  amount_digits: string
  due_at: string
  contract_date: string
  party_identity: string
  pledger_requisites: string
}

export const title = "Договор залога имущественного права"
export const description = "Договор между кооперативом и пайщиком о залоге имущественного права пайщика на возврат части паевого взноса в обеспечение беспроцентного займа"

export const context = "<div class=\"digital-document\"><div style=\"text-align: right\"><p>ПРИЛОЖЕНИЕ № {{short_hash}}</p><p>к {{basis_title_dative}} № {{basis_number}}</p></div><h2 style=\"text-align: center\">Договор залога Имущественного права</h2><table style=\"width: 100%; border-collapse: collapse; margin: 0 0 8px 0\"><tr><td style=\"padding: 0; vertical-align: top\">г. {{coop.city}}</td><td style=\"padding: 0; text-align: right; vertical-align: top\">{{created_at}}</td></tr></table><p>{{vars.full_abbr}} «{{vars.name}}» в лице Председателя Совета {{coop.chairman.first_name}} {{coop.chairman.middle_name}} {{coop.chairman.last_name}}, действующего на основании Устава, именуемый в дальнейшем «Общество/Залогодержатель», с одной стороны, и пайщик {{user.full_name_or_short_name}}{{party_identity}}, именуемый в дальнейшем «Пайщик/Залогодатель», с другой стороны, именуемые в дальнейшем «Стороны», заключили настоящий договор (далее «Договор»), о нижеследующем:</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">1. ПРЕДМЕТ ДОГОВОРА</p><p>1.1. В обеспечение обязательств по Договору о беспроцентном займе от {{contract_date}}, являющегося приложением № {{short_hash}} к {{basis_title_dative}} № {{basis_number}}, далее по тексту – «Договор беспроцентного займа», Залогодатель предоставил в залог Залогодержателю Имущественные права по возврату своего паевого взноса, в соответствии с {{basis_title_instrumental}} № {{basis_number}} от {{basis_date}}, далее по тексту – «Предмет залога».</p><p>1.2. В соответствии с условиями Договора беспроцентного займа Пайщик обязан в срок до {{due_at}} возвратить полученный заем в размере {{amount_digits}}.</p><p>1.3. Залогодатель гарантирует, что Предмет залога ранее нигде не заложен и свободен от долгов и прав третьих лиц.</p><p>1.4. Стоимость Предмета залога настоящим согласована Сторонами и составляет {{amount_digits}}.</p><p>1.5. Предметом залога полностью обеспечивается исполнение Пайщиком обязательств по Договору беспроцентного займа.</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</p><p>2.1. Залогодатель вправе распоряжаться Предметом залога только с согласия Залогодержателя.</p><p>2.2. Залогодержатель имеет право потребовать досрочного исполнения обязательств по своевременному возврату полученного займа, если Предмет залога утрачен (или имеется реальная возможность его утраты в будущем), и Залогодатель не восстановил его или с согласия Залогодержателя не заменил.</p><p>2.3. Ответственность Залогодателя наступает при:</p><p>— невыполнении Пайщиком обязанностей, предусмотренных Договором беспроцентного займа;</p><p>— нарушении Залогодателем обязанностей по настоящему Договору;</p><p>— уклонении от замены Предмета залога, в случаях предусмотренных настоящим Договором;</p><p>— нарушении Залогодателем иных обязанностей, предусмотренных действующим законодательством.</p><p>2.4. При наступлении ответственности Залогодателя, Залогодержатель вправе обратить взыскание на Предмет залога.</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">3. ПОРЯДОК ВЗЫСКАНИЯ ПРЕДМЕТА ЗАЛОГА</p><p>3.1. В случае обращения Общества по взысканию Предмета залога, требования Залогодержателя удовлетворяются без обращения в суд (во внесудебном порядке).</p><p>3.2. Взыскание Предмета залога удовлетворяет требования Залогодержателя в полном объеме.</p><p>3.3. При неисполнении или ненадлежащем исполнении Пайщиком своих обязательств по Договору беспроцентного займа, Общество направляет Пайщику уведомление в его ЛК о факте неисполнения обязательств Пайщиком и, в случае отсутствия согласованного способа и сроков урегулирования обязательств Пайщика и Общества по возврату займа в течение 5 (пяти) дней с даты уведомления, Общество направляет на ЛК Пайщика односторонний акт взыскания в свою пользу Предмета залога.</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">4. СРОК ДЕЙСТВИЯ И ПРЕКРАЩЕНИЕ ДОГОВОРА</p><p>4.1. Настоящий Договор вступает в силу со дня его подписания Сторонами и действует до момента исполнения обеспеченного Предметом залога обязательства Пайщика по Договору беспроцентного займа.</p><p>4.2. Действие настоящего Договора сохраняется в первоначальном объеме до полного исполнения Пайщиком обеспеченного Предметом залога обязательства Пайщика по Договору беспроцентного займа.</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">5. ДРУГИЕ УСЛОВИЯ</p><p>5.1. Настоящий Договор может быть изменен или дополнен по соглашению Сторон. Все изменения и дополнения к настоящему Договору считаются действительными, если они выполнены в письменной форме и подписаны Сторонами.</p><p>5.2. В случае неисполнения (ненадлежащего исполнения) настоящего Договора Стороны несут ответственность в соответствии с условиями настоящего Договора и действующим законодательством.</p><p>5.3. Все споры и разногласия, возникающие между Сторонами в процессе исполнения настоящего Договора, разрешаются путем переговоров. При недостижении согласия споры рассматриваются в суде по месту нахождения Залогодержателя, а по исковому заявлению Залогодателя – в суде, определяемом в соответствии с действующим законодательством РФ.</p><p>5.4. Настоящий Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из сторон.</p><p>5.5. Настоящий Договор, где это применимо, использует термины и определения {{basis_title_genitive}} № {{basis_number}} от {{basis_date}}, приложением к которому он является.</p><p style=\"font-weight: 700; margin: 16px 0 8px 0\">6. АДРЕСА И РЕКВИЗИТЫ СТОРОН</p><table style=\"width: 100%; border-collapse: collapse; margin: 0 0 8px 0\"><tr><td style=\"padding: 0 8px 0 0; vertical-align: top; width: 50%\"><p>Залогодержатель: {{vars.full_abbr}} «{{vars.name}}»</p><p>Юр. адрес: {{coop.full_address}}</p><p>ИНН: {{coop.details.inn}}</p><p>КПП: {{coop.details.kpp}}</p><p>Банк: {{coop.defaultBankAccount.bank_name}}</p><p>Рас./счёт: {{coop.defaultBankAccount.account_number}}</p><p>Корр./счёт: {{coop.defaultBankAccount.details.corr}}</p><p>БИК: {{coop.defaultBankAccount.details.bik}}</p></td><td style=\"padding: 0; vertical-align: top; width: 50%\"><p>Залогодатель: {{user.full_name_or_short_name}}</p><p>{{pledger_requisites}}</p></td></tr></table><p style=\"font-weight: 700; margin: 16px 0 8px 0\">7. ПОДПИСИ СТОРОН</p><table style=\"width: 100%; border-collapse: collapse; margin: 0 0 8px 0\"><tr><td style=\"padding: 0 8px 0 0; vertical-align: top; width: 50%\"><p>Залогодержатель</p><p>Председатель Совета {{coop.chairman.last_name}} {{coop.chairman.first_name}} {{coop.chairman.middle_name}}</p><p>Подписано электронной подписью</p></td><td style=\"padding: 0; vertical-align: top; width: 50%\"><p>Залогодатель</p><p>{{user.full_name_or_short_name}}</p><p>Подписано электронной подписью</p></td></tr></table></div><style>.digital-document {padding: 20px;white-space: pre-wrap;} .digital-document p {margin: 0 0 8px 0;} .digital-document h2 {margin: 16px 0 8px 0;} .digital-document h3 {margin: 16px 0 8px 0;}</style>"

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
  "due_at": "07.04.2027",
  "contract_date": "07.10.2026",
  "party_identity": ", паспорт: серия 4510, № 123456, выданный ОУФМС России по г. Москве 12.03.2015, проживающий по адресу: г. Москва, ул. Садовая, д. 1, кв. 1",
  "pledger_requisites": "Регистрация: г. Москва, ул. Садовая, д. 1, кв. 1\nПаспорт серия: 4510\nНомер: 123456\nВыдан: 12.03.2015\nКем: ОУФМС России по г. Москве\nТелефон: +7 999 123-45-67"
}
