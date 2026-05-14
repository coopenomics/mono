import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 1100

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа — шаблон публичной оферты ЦПП «Стол заказов» для утверждения Советом.
// Утверждается Советом (Story 1.9), нивелируется при регистрации пайщика (Story 1.11)
// либо предъявляется L3 fallback gate на столе (Story 1.4).
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
}

export const title = 'Пользовательское соглашение (оферта) по присоединению к ЦПП «СТОЛ ЗАКАЗОВ»'
export const description = 'Шаблон публичной оферты по ЦПП «СТОЛ ЗАКАЗОВ» для утверждения Советом'

// Placeholder context: финальная редакция оферты ЦПП «Стол заказов» готовится
// юридическим отделом (см. todo-tspp-templates.md). Структура повторяет
// 999.BlagorostOfferTemplate, замена будет одной правкой `context` +
// `translations` без изменения registry_id и подписей пайщиков.
export const context = `<div class="digital-document"><div style="text-align: center"><h1 class="header">{% trans 'OFFER_TITLE' %}</h1><p class="subheader">{% trans 'offer_template_subtitle' %}</p></div><p class="placeholder-notice"><em>{% trans 'placeholder_notice' %}</em></p><p>{% trans 'offer_template_intro_1' %} {{coop.chairman.last_name}} {{coop.chairman.first_name}} {{coop.chairman.middle_name}}{% trans 'offer_template_intro_2' %}</p><p>{% trans 'offer_template_legal_basis' %} {{ vars.marketplace_program.protocol_number }} {% trans 'from' %} {{ vars.marketplace_program.protocol_day_month_year }}{% trans 'offer_template_legal_basis_2' %}</p><p>{% trans 'offer_template_acceptance' %} {{vars.website}} {% trans 'offer_template_acceptance_2' %}</p><div style="text-align: center"><h3>{% trans 'terms_title' %}</h3></div><p><strong>1.1.</strong> {% trans 'platform_term_definition' %}</p><p><strong>1.2.</strong> {% trans 'order_term_definition' %}</p><p><strong>1.3.</strong> {% trans 'supply_term_definition' %}</p><p><strong>1.4.</strong> {% trans 'participant_term_definition' %}</p><p><strong>1.5.</strong> {% trans 'site_term_definition' %}</p><div style="text-align: center"><h3>{% trans 'goals_title' %}</h3></div><p><strong>2.1.</strong> {% trans 'goals_intro_template' %}</p><div style="text-align: center"><h3>{% trans 'order_mechanism_title' %}</h3></div><p><strong>3.1.</strong> {% trans 'order_mechanism_intro_template' %}</p><div style="text-align: center"><h3>{% trans 'return_mechanism_title' %}</h3></div><p><strong>4.1.</strong> {% trans 'return_mechanism_intro_template' %}</p><div style="text-align: center"><h3>{% trans 'rights_obligations_title' %}</h3></div><p><strong>5.1.</strong> {% trans 'rights_obligations_intro_template' %}</p><div class="signature"><p style="margin-top: 40px;"><strong>{% trans 'agreement_signature_template' %}</strong></p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}.placeholder-notice {background: #fff3cd; padding: 10px; border-radius: 4px;}.subheader {padding-bottom: 20px;}.signature {padding-top: 20px;}</style>`

export const translations = {
  ru: {
    OFFER_TITLE: 'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (ОФЕРТА) № ______',
    offer_template_subtitle:
      'по присоединению пайщиков Потребительского Кооператива "ВОСХОД" к целевой потребительской программе "СТОЛ ЗАКАЗОВ"',
    placeholder_notice:
      'РЫБА ДОКУМЕНТА. Финальная редакция оферты ЦПП «Стол заказов» готовится; до момента её утверждения этот документ занимает registry_id=1100 в платформенном реестре документов и используется как структурный заполнитель Story 1.7.',
    offer_template_intro_1: 'Потребительский Кооператив «ВОСХОД» (далее «Общество») в лице Председателя Совета ',
    offer_template_intro_2:
      ', действующего на основании Устава с одной стороны, и Участник целевой потребительской программы "СТОЛ ЗАКАЗОВ" __________________________, действующий на основании собственного волеизъявления, с другой стороны, а вместе Стороны, согласились с нижеследующим:',
    offer_template_legal_basis:
      'Настоящее Пользовательское соглашение, составленное в соответствии с Гражданским кодексом РФ, Уставом Общества и на основании Положения Общества о целевой потребительской программе "СТОЛ ЗАКАЗОВ", утвержденном Собранием Совета Общества (Протокол №',
    from: 'от',
    offer_template_legal_basis_2:
      '), формулируют соглашение между Обществом и Пайщиком, а также является по отношению к Пайщику Офертой от Общества, где Общество является Оферентом, а Пайщик является Акцептантом.',
    offer_template_acceptance:
      'Отметка о Согласии __________________________ с Настоящим Пользовательским соглашением производится электронно, а дата создания Личного кабинета пайщика на сайте',
    offer_template_acceptance_2:
      'считается акцептом __________________________ настоящей Оферты как пайщика Общества по взаимодействию между Пайщиком и Обществом в соответствии с условиями целевой потребительской программы "СТОЛ ЗАКАЗОВ" (далее "ЦПП").',
    terms_title: '1. Термины и определения [рыба]',
    platform_term_definition:
      '«Платформа» — информационная экосистема Цифрового кооператива, в которой реализована хозяйственная деятельность Общества в рамках ЦПП.',
    order_term_definition:
      '«Заказ» — потребительский паевой взнос Участника в рамках ЦПП с целью получения товара, поставленного другим Участником-поставщиком в режиме кооперативного некоммерческого обмена.',
    supply_term_definition:
      '«Поставка» — внесение Участником-поставщиком имущественного паевого взноса в виде товаров для дальнейшего распределения между Участниками-заказчиками.',
    participant_term_definition:
      '«Участник ЦПП (Участник) — пайщик», подтвердивший намерение участвовать в хозяйственной деятельности Общества фактом акцепта настоящего Пользовательского Соглашения.',
    site_term_definition:
      '«Сайт» — официальный сайт Общества, на котором опубликованы информация о ЦПП, текст настоящих общих условий и Положения о ЦПП, а также ЛК Участников.',
    goals_title: '2. Цели и задачи [рыба]',
    goals_intro_template:
      'Целями ЦПП являются удовлетворение потребностей Участников в товарах для личного потребления и развитие некоммерческого обмена внутри Платформы.',
    order_mechanism_title: '3. Хозяйственный механизм заказа и поставки [рыба]',
    order_mechanism_intro_template:
      'Участник-заказчик направляет потребительский паевой взнос; Участник-поставщик принимает заказ и поставляет товар. Расчёты и поставки идут через Цифровой кошелёк Платформы.',
    return_mechanism_title: '4. Возврат и гарантийный возврат [рыба]',
    return_mechanism_intro_template:
      'Право требования возврата паевого взноса возникает при невыполнении поставки или ненадлежащем качестве товара в порядке, установленном настоящим Соглашением.',
    rights_obligations_title: '5. Права и обязанности Сторон [рыба]',
    rights_obligations_intro_template:
      'Подробный перечень прав и обязанностей Участника и Общества будет уточнён в финальной редакции.',
    agreement_signature_template:
      '"СОГЛАСЕН"   _____________________________ (ФИО) ____________________ (Подпись) ___________________ (Дата)',
  },
}

export const exampleData = {
  coop: {
    chairman: {
      last_name: 'Муравьев',
      first_name: 'Алексей',
      middle_name: 'Николаевич',
    },
  },
  vars: {
    name: 'ВОСХОД',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    marketplace_program: {
      protocol_number: '01-05-2026',
      protocol_day_month_year: '01 мая 2026 г.',
    },
  },
}
