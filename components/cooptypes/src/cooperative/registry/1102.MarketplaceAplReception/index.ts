import type { IGenerate, IMetaDocument } from '../../document'
import type { ICooperativeData, IVars } from '../../model'

export const registry_id = 1102

// Действие генерации акта приёмки имущества на кооперативном участке.
// Один экземпляр документа = один Order в составе АПП; на одну АПП с
// несколькими Order'ами рендерится столько же документов. Документ
// подписывается поставщиком (action marketplace::signsupp) и
// председателем КУ-приёмника (action marketplace::signchair) — payload
// (act: IDocument2) одинаковый, отличается только подписант.
export interface Action extends IGenerate {
  /** id Order'а, к которому относится АПП. */
  order_id: string
  /** Канонический order_hash on-chain. */
  order_hash: string
  /** Имя кооперативного участка-приёмника (braname). */
  accept_braname: string
  /** id записи АПП в инфраструктуре marketplace. */
  reception_id: string
  /** Фактическое количество единиц, принятое на КУ. */
  fact_quantity: number
  /** Сумма по Order'у с учётом фактического количества (строка с 4 знаками). */
  total_amount: string
  /** Account поставщика — отправитель партии. */
  supplier_account: string
  /** Account председателя — подписант закрывающей подписи (заполняется при signchair). */
  chairman_account?: string
  /** Флаг пропуска сохранения документа (preview-режим). */
  skip_save: boolean
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  order_id: string
  order_hash: string
  accept_braname: string
  reception_id: string
  fact_quantity: number
  total_amount: string
  supplier_account: string
  chairman_account?: string
}

export const title = 'Акт приёмки имущества на кооперативный участок'
export const description =
  'Электронный акт фиксации факта приёмки партии Order\'а на КУ. Подписывается поставщиком (первая подпись) и председателем КУ (закрывающая подпись). При закрывающей подписи имущество переходит на баланс кооператива.'

// Placeholder context: финальная редакция готовится юридическим отделом.
// До утверждения instance занимает registry_id=1102 в платформенном
// реестре и используется как структурный заполнитель.
export const context = `<div class="digital-document"><div style="text-align: right; margin-bottom: 20px;"><p style="margin: 0px !important">{% trans 'APPROVED' %}</p><p style="margin: 0px !important">{% trans 'protocol' %} {{ vars.marketplace_program.protocol_number }}</p><p style="margin: 0px !important">{{ coop.short_name }}</p><p style="margin: 0px !important">{% trans 'from' %} {{ vars.marketplace_program.protocol_day_month_year }}</p></div><div style="text-align: center"><h1 class="header">{% trans 'APL_RECEPTION_TITLE' %}</h1><p class="subheader">{% trans 'apl_reception_subtitle' %}</p></div><p class="placeholder-notice"><em>{% trans 'placeholder_notice' %}</em></p><p>{% trans 'reception_intro' %} {{ coop.full_name }}.</p><p><strong>{% trans 'order_label' %}:</strong> {{ order_id }} ({% trans 'order_hash_label' %}: {{ order_hash }})</p><p><strong>{% trans 'supplier_label' %}:</strong> {{ supplier_account }}</p><p><strong>{% trans 'accept_braname_label' %}:</strong> {{ accept_braname }}</p><p><strong>{% trans 'fact_quantity_label' %}:</strong> {{ fact_quantity }}</p><p><strong>{% trans 'total_amount_label' %}:</strong> {{ total_amount }}</p><p>{% trans 'reception_clause_1' %}</p><p>{% trans 'reception_clause_2' %}</p><div class="signature"><p style="margin-top: 40px;"><strong>{% trans 'signature_supplier' %} {{ supplier_account }}</strong></p>{% if chairman_account %}<p><strong>{% trans 'signature_chairman' %} {{ chairman_account }}</strong></p>{% endif %}<p>{{ meta.created_at }}</p><p>{% trans 'signed_electronically' %}</p></div></div><style>.digital-document {padding: 20px;white-space: pre-wrap;}.placeholder-notice {background: #fff3cd; padding: 10px; border-radius: 4px;}.subheader {padding-bottom: 20px;}.signature {padding-top: 20px;}</style>`

export const translations = {
  ru: {
    APPROVED: 'УТВЕРЖДЕНО:',
    protocol: 'Протоколом Совета №',
    from: 'от',
    APL_RECEPTION_TITLE: 'АКТ ПРИЁМКИ ИМУЩЕСТВА НА КООПЕРАТИВНЫЙ УЧАСТОК',
    apl_reception_subtitle:
      'фиксация факта приёмки партии в рамках целевой потребительской программы «СТОЛ ЗАКАЗОВ»',
    placeholder_notice:
      'РЫБА ДОКУМЕНТА. Финальная редакция АПП готовится юридическим отделом; до её утверждения instance занимает registry_id=1102 в платформенном реестре документов и используется как структурный заполнитель.',
    reception_intro:
      'Настоящий акт составлен в рамках целевой потребительской программы «СТОЛ ЗАКАЗОВ»',
    order_label: 'Заказ',
    order_hash_label: 'хэш заказа',
    supplier_label: 'Поставщик',
    accept_braname_label: 'Кооперативный участок-приёмник',
    fact_quantity_label: 'Фактически принято единиц',
    total_amount_label: 'Сумма по заказу',
    reception_clause_1:
      'Поставщик подтверждает факт передачи указанного количества имущества на кооперативный участок-приёмник в рамках программы.',
    reception_clause_2:
      'Председатель кооперативного участка закрывающей подписью подтверждает приёмку имущества на баланс кооператива.',
    signature_supplier: 'Подпись поставщика:',
    signature_chairman: 'Подпись председателя КУ:',
    signed_electronically: 'Подписано электронной подписью',
  },
}

export const exampleData = {
  coop: {
    short_name: 'ПК «ВОСХОД»',
    full_name: 'потребительский кооператив «Восход»',
    city: 'Москва',
  },
  vars: {
    marketplace_program: {
      protocol_number: '01-05-2026',
      protocol_day_month_year: '01 мая 2026 г.',
    },
  },
  meta: {
    created_at: '14.05.2026 11:30',
  },
  order_id: 'order-uuid-1',
  order_hash: '0000abcd...',
  accept_braname: 'ku-moscow-1',
  reception_id: 'apl-uuid-1',
  fact_quantity: 10,
  total_amount: '1000.0000',
  supplier_account: 'supplier1',
  chairman_account: 'chairman1',
}
