import type { IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'

export const registry_id = 1101

// Модель действия для генерации.
//
// Эпик 1 / Story 1.11 + Story 1.4 (L3 fallback). Backend marketplace вычисляет
// `marketplace_agreement_number` и `marketplace_agreement_created_at` в момент
// L3-подписи (или core registration-flow при L2) и передаёт их в render
// явно — без обращения к Udata, потому что они уникальны для одной подписи
// и не переиспользуются как для Благороста.
export interface Action extends IGenerate {
  registry_id: number
  marketplace_agreement_number: string
  marketplace_agreement_created_at: string
}

export type Meta = IMetaDocument & Action

// Инстанс оферты ЦПП «Стол заказов» для конкретного пайщика
// (renderуется из шаблона 1100.MarketplaceOfferTemplate). Создаётся:
//  • при регистрации пайщика (Story 1.11, L2 онбординг);
//  • при подписании через L3 fallback gate на столе (Story 1.4 после
//    активации mutation подписания).
export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  common_user: ICommonUser
  marketplace_agreement_number: string
  marketplace_agreement_created_at: string
}

export const title = 'Пользовательское соглашение (оферта) по присоединению к ЦПП «СТОЛ ЗАКАЗОВ»'
export const description = 'Публичная оферта по ЦПП «СТОЛ ЗАКАЗОВ» для пайщика с утвержденным шаблоном'

// Placeholder context: финальная редакция готовится юристом (см.
// 1100.MarketplaceOfferTemplate). Здесь воспроизводится та же структура
// с подстановкой персональных данных пайщика.
export const context = `<div class="digital-document"><div style="text-align: right; margin-bottom: 20px;"><p style="margin: 0px !important">{% trans 'APPROVED' %}</p><p style="margin: 0px !important">{% trans 'protocol' %} {{ vars.marketplace_offer_template.protocol_number }}</p><p style="margin: 0px !important">{{vars.full_abbr_genitive}} «{{vars.name}}»</p><p style="margin: 0px !important">{% trans 'from' %} {{ vars.marketplace_offer_template.protocol_day_month_year }}</p></div><div style="text-align: center"><h1 class="header">{% trans 'OFFER_TITLE', marketplace_agreement_number %}</h1><p class="subheader">{% trans 'offer_subtitle' %}</p></div><p class="placeholder-notice"><em>{% trans 'placeholder_notice' %}</em></p><p>{% trans 'offer_intro_1' %} {{coop.chairman.last_name}} {{coop.chairman.first_name}} {{coop.chairman.middle_name}}{% trans 'offer_intro_2' %} {{common_user.full_name_or_short_name}}{% trans 'offer_intro_3' %}</p><p>{% trans 'offer_legal_basis' %} {{ vars.marketplace_program.protocol_number }} {% trans 'from' %} {{ vars.marketplace_program.protocol_day_month_year }}{% trans 'offer_legal_basis_2' %}</p><p>{% trans 'offer_acceptance' %} {{common_user.full_name_or_short_name}} {% trans 'offer_acceptance_2' %} {{vars.website}} {% trans 'offer_acceptance_3' %} {{common_user.full_name_or_short_name}} {% trans 'offer_acceptance_4' %}</p><div style="text-align: center"><h3>{% trans 'terms_title' %}</h3></div><p><strong>1.1.</strong> {% trans 'platform_term_definition' %}</p><p><strong>1.2.</strong> {% trans 'order_term_definition' %}</p><p><strong>1.3.</strong> {% trans 'supply_term_definition' %}</p><p><strong>1.4.</strong> {% trans 'participant_term_definition' %}</p><p><strong>1.5.</strong> {% trans 'site_term_definition' %}</p><div style="text-align: center"><h3>{% trans 'goals_title' %}</h3></div><p><strong>2.1.</strong> {% trans 'goals_intro' %}</p><div style="text-align: center"><h3>{% trans 'order_mechanism_title' %}</h3></div><p><strong>3.1.</strong> {% trans 'order_mechanism_intro' %}</p><div style="text-align: center"><h3>{% trans 'return_mechanism_title' %}</h3></div><p><strong>4.1.</strong> {% trans 'return_mechanism_intro' %}</p><div style="text-align: center"><h3>{% trans 'rights_obligations_title' %}</h3></div><p><strong>5.1.</strong> {% trans 'rights_obligations_intro' %}</p><div class="signature"><p style="margin-top: 40px;"><strong>{% trans 'agreement_signature' %} {{common_user.full_name_or_short_name}}</strong></p><p>{{marketplace_agreement_created_at}}</p><p>{% trans 'signed_electronically' %}</p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}.placeholder-notice {background: #fff3cd; padding: 10px; border-radius: 4px;}.subheader {padding-bottom: 20px;}.signature {padding-top: 20px;}</style>`

export const translations = {
  ru: {
    APPROVED: 'УТВЕРЖДЕНО:',
    protocol: 'Протоколом Совета №',
    from: 'от',
    OFFER_TITLE: 'ПОЛЬЗОВАТЕЛЬСКОЕ СОГЛАШЕНИЕ (ОФЕРТА) № {0}',
    offer_subtitle:
      'по присоединению пайщиков Потребительского Кооператива "ВОСХОД" к целевой потребительской программе "СТОЛ ЗАКАЗОВ"',
    placeholder_notice:
      'РЫБА ДОКУМЕНТА. Финальная редакция оферты ЦПП «Стол заказов» готовится юридическим отделом; до её утверждения instance занимает registry_id=1101 в платформенном реестре документов и используется как структурный заполнитель.',
    offer_intro_1: 'Потребительский Кооператив «ВОСХОД» (далее «Общество») в лице Председателя Совета ',
    offer_intro_2: ', действующего на основании Устава с одной стороны, и Участник целевой потребительской программы "СТОЛ ЗАКАЗОВ" ',
    offer_intro_3: ', действующий на основании собственного волеизъявления, с другой стороны, а вместе Стороны, согласились с нижеследующим:',
    offer_legal_basis:
      'Настоящее Пользовательское соглашение, составленное в соответствии с Гражданским кодексом РФ, Уставом Общества и на основании Положения Общества о целевой потребительской программе "СТОЛ ЗАКАЗОВ", утвержденном Собранием Совета Общества (Протокол №',
    offer_legal_basis_2:
      '), формулируют соглашение между Обществом и Пайщиком, а также является по отношению к Пайщику Офертой от Общества, где Общество является Оферентом, а Пайщик является Акцептантом.',
    offer_acceptance: 'Отметка о Согласии',
    offer_acceptance_2: 'с Настоящим Пользовательским соглашением производится электронно, а дата создания Личного кабинета пайщика на сайте',
    offer_acceptance_3: 'считается акцептом',
    offer_acceptance_4:
      'настоящей Оферты как пайщика Общества по взаимодействию между Пайщиком и Обществом в соответствии с условиями целевой потребительской программы "СТОЛ ЗАКАЗОВ".',
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
    goals_intro:
      'Целями ЦПП являются удовлетворение потребностей Участников в товарах для личного потребления и развитие некоммерческого обмена внутри Платформы.',
    order_mechanism_title: '3. Хозяйственный механизм заказа и поставки [рыба]',
    order_mechanism_intro:
      'Участник-заказчик направляет потребительский паевой взнос; Участник-поставщик принимает заказ и поставляет товар. Расчёты и поставки идут через Цифровой кошелёк Платформы.',
    return_mechanism_title: '4. Возврат и гарантийный возврат [рыба]',
    return_mechanism_intro:
      'Право требования возврата паевого взноса возникает при невыполнении поставки или ненадлежащем качестве товара в порядке, установленном настоящим Соглашением.',
    rights_obligations_title: '5. Права и обязанности Сторон [рыба]',
    rights_obligations_intro:
      'Подробный перечень прав и обязанностей Участника и Общества будет уточнён в финальной редакции.',
    agreement_signature: '"СОГЛАСЕН"',
    signed_electronically: 'Подписано электронной подписью',
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
    full_abbr_genitive: 'Потребительского Кооператива',
    name: 'ВОСХОД',
    website: 'цифровой-кооператив.рф',
    marketplace_program: {
      protocol_number: '01-05-2026',
      protocol_day_month_year: '01 мая 2026 г.',
    },
    marketplace_offer_template: {
      protocol_number: '15-05-2026',
      protocol_day_month_year: '15 мая 2026 г.',
    },
  },
  common_user: {
    full_name_or_short_name: 'Иванов Иван Иванович',
  },
  marketplace_agreement_number: '12345',
  marketplace_agreement_created_at: '14.05.2026',
}
