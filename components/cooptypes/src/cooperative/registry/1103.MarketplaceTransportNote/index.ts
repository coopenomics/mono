import type { IDocDataRef, IGenerate, IMetaDocument } from '../../document'
import type { ICommonUser, ICooperativeData, IVars } from '../../model'
import type { IOrganizationData } from '../../users'

export const registry_id = 1103

/**
 * Приватный payload транспортной накладной (ТТН).
 *
 * Хранится off-chain в коллекции `doc_private_data` фабрики; on-chain
 * публикуется только `doc_data_hash`. Содержимое — персональные данные
 * экспедитора и параметры физической перевозки, которые недопустимо
 * публиковать в блокчейн. См. раздел «Document Generation Pattern:
 * doc_data» в архитектуре.
 */
export interface PrivateData {
  /** Полное наименование экспедитора (ФИО). */
  expeditor_full_name: string
  /** Контактный телефон экспедитора. */
  expeditor_phone: string
  /** Номер транспортного средства. */
  vehicle_number: string
  /** Адрес погрузки. */
  loading_address: string
  /** Дата и время погрузки (ISO-8601). */
  loading_datetime: string
  /** Плановая дата и время доставки на КУ (ISO-8601). */
  delivery_datetime_estimate: string
}

// Модель действия для генерации транспортной накладной (ТТН) Варианта Б.
// Документ генерируется при формировании партии поставки (Shipment),
// сохраняется в локальном marketplace-реестре `marketplace_ttn_document`
// и не публикуется в общий реестр документов кооператива — экспедиторы
// пока не подписывают перевозку. Ссылка на ТТН вшивается в АПП приёмки
// через `Shipment.ttn_document_id`.
//
// **Данные экспедитора и параметры перевозки** (ФИО, телефон, госномер, адрес
// погрузки и т.п.) хранятся off-chain в `doc_private_data`; on-chain — только
// `doc_data_hash`. Паспорт/удостоверение НЕ собираем и НЕ храним (минимизация ПДн).
export interface Action extends IGenerate, IDocDataRef {
  registry_id: number
  /** Уникальный номер ТТН (формат `ТТН-<12 HEX>`). */
  ttn_number: string
  /** id заявки (cycle), в рамках которой формируется партия. */
  cycle_id: string
  /** id партии поставки (Shipment), к которой относится ТТН. */
  shipment_id: string
  /** Имя кооперативного участка-приёмника (braname). */
  accept_braname: string
  /** Account поставщика — отправитель партии. */
  supplier_account: string
  /** Сумма партии с 4 знаками после запятой. */
  total_amount: string
  /** Символ валюты, в которой выражена сумма. */
  currency: string
  /** sha256 хэш приватного payload (PrivateData) — обязательное для ТТН. */
  doc_data_hash: string
}

export type Meta = IMetaDocument & Action

export interface Model {
  meta: IMetaDocument
  coop: ICooperativeData
  vars: IVars
  ttn_number: string
  cycle_id: string
  shipment_id: string
  accept_braname: string
  total_amount: string
  currency: string
  supplier_account: string
  /**
   * Поставщик — резолвится фабрикой по `supplier_account` в орг-или-ФИО
   * (`full_name_or_short_name`): для физлица/ИП — ФИО, для организации —
   * краткое наименование. Раньше было только ФИО → для орг-поставщика пусто.
   */
  supplier: ICommonUser
  /** Приватные данные экспедитора и параметры перевозки (off-chain). */
  doc_data: PrivateData
  /** Карточка КУ-приёмника — резолвится фабрикой по `accept_braname`. */
  branch?: IOrganizationData
}

export const title = 'Транспортная накладная (ТТН)'
export const description = 'Транспортная накладная на перевозку партии имущества от поставщика на кооперативный участок-приёмник через экспедитора.'

export const context = `<style>
h1 { margin: 0px; text-align: center; }
h3 { margin: 0px; padding-top: 15px; }
.digital-document { padding: 20px; }
.digital-document p { margin: 0 0 6px; }
.subheader { padding-bottom: 20px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid currentColor; padding: 8px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
th {  width: 35%; }
</style>

<div class="digital-document">
  <h1 class="header">{% trans 'ttn_number_label', ttn_number %}</h1>
  <p style="text-align:center" class="subheader">{% trans 'ttn_subtitle' %}</p>
  <p style="text-align: right">{{ meta.created_at }}, {{ coop.city }}</p>

  <p>{% trans 'ttn_intro', vars.full_abbr, vars.name, supplier.full_name_or_short_name %}</p>

  <table>
    <tbody>
      <tr>
        <th>{% trans 'shipment_label' %}</th>
        <td>{{ shipment_id }}</td>
      </tr>
      <tr>
        <th>{% trans 'cycle_label' %}</th>
        <td>{{ cycle_id }}</td>
      </tr>
      <tr>
        <th>{% trans 'accept_braname_label' %}</th>
        <td>{{ accept_braname }}</td>
      </tr>
      <tr>
        <th>{% trans 'total_amount_label', currency %}</th>
        <td>{{ total_amount }}</td>
      </tr>
    </tbody>
  </table>

  <h3>{% trans 'expeditor_section' %}</h3>
  <table>
    <tbody>
      <tr>
        <th>{% trans 'expeditor_full_name_label' %}</th>
        <td>{{ doc_data.expeditor_full_name }}</td>
      </tr>
      <tr>
        <th>{% trans 'expeditor_phone_label' %}</th>
        <td>{{ doc_data.expeditor_phone }}</td>
      </tr>
    </tbody>
  </table>

  <h3>{% trans 'transport_section' %}</h3>
  <table>
    <tbody>
      <tr>
        <th>{% trans 'vehicle_number_label' %}</th>
        <td>{{ doc_data.vehicle_number }}</td>
      </tr>
      <tr>
        <th>{% trans 'loading_address_label' %}</th>
        <td>{{ doc_data.loading_address }}</td>
      </tr>
      <tr>
        <th>{% trans 'loading_datetime_label' %}</th>
        <td>{{ doc_data.loading_datetime }}</td>
      </tr>
      <tr>
        <th>{% trans 'delivery_datetime_estimate_label' %}</th>
        <td>{{ doc_data.delivery_datetime_estimate }}</td>
      </tr>
    </tbody>
  </table>

  <div class="signature" style="padding-top: 20px;">
    <table>
      <tbody>
        <tr>
          <th></th>
          <td>{% trans 'role_label' %}</td>
          <td>{% trans 'full_name_label' %}</td>
          <td>{% trans 'signature_label' %}</td>
        </tr>
        <tr>
          <th>{% trans 'shipped' %}</th>
          <td>{% trans 'supplier_role' %}</td>
          <td>{{ supplier.full_name_or_short_name }}</td>
          <td>{% trans 'signature_placeholder' %}</td>
        </tr>
        <tr>
          <th>{% trans 'transported' %}</th>
          <td>{% trans 'expeditor_role' %}</td>
          <td>{{ doc_data.expeditor_full_name }}</td>
          <td>{% trans 'signature_placeholder' %}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
`

export const translations = {
  ru: {
    ttn_number_label: 'ТРАНСПОРТНАЯ НАКЛАДНАЯ № {0}',
    ttn_subtitle: 'на перевозку партии имущества по Целевой Потребительской Программе «Стол заказов»',
    ttn_intro: '{0} "{1}" (далее – Кооператив) принимает к перевозке партию имущества, отправляемую пайщиком-поставщиком {2} (далее – Поставщик), на основании настоящей транспортной накладной.',
    shipment_label: 'Партия поставки',
    cycle_label: 'Консолидированная заявка',
    accept_braname_label: 'Кооперативный участок-приёмник',
    total_amount_label: 'Стоимость партии, {0}',
    expeditor_section: 'Экспедитор',
    transport_section: 'Транспортировка',
    expeditor_full_name_label: 'ФИО экспедитора',
    expeditor_phone_label: 'Телефон экспедитора',
    vehicle_number_label: 'Номер транспортного средства',
    loading_address_label: 'Адрес погрузки',
    loading_datetime_label: 'Дата и время погрузки',
    delivery_datetime_estimate_label: 'Плановая дата и время доставки',
    role_label: 'Роль',
    full_name_label: 'ФИО',
    signature_label: 'Подпись',
    shipped: 'Передал',
    transported: 'Принял к перевозке',
    supplier_role: 'Поставщик',
    expeditor_role: 'Экспедитор',
    signature_placeholder: 'подписан электронной подписью',
  },
}

export const exampleData = {
  meta: {
    created_at: '12.05.2026 11:30',
  },
  coop: {
    city: 'Москва',
  },
  vars: {
    full_abbr: 'Потребительский Кооператив',
    name: 'ВОСХОД',
  },
  ttn_number: 'ТТН-A1B2C3D4E5F6',
  cycle_id: 'cycle-uuid-1',
  shipment_id: 'shipment-uuid-1',
  accept_braname: 'KU-MOSCOW-1',
  total_amount: '12500.0000',
  currency: 'RUB',
  supplier_account: 'supplier1',
  supplier: {
    full_name_or_short_name: 'ООО "РОМАШКА"',
    birthdate_or_ogrn: '1234567890123',
    abbr_full_name: 'Общество с ограниченной ответственностью "РОМАШКА"',
    email: 'supplier@example.com',
    phone: '+7 (999) 765-43-21',
  },
  doc_data: {
    expeditor_full_name: 'Сидоров Сидор Сидорович',
    expeditor_phone: '+7 (999) 123-45-67',
    vehicle_number: 'А123БВ77',
    loading_address: 'г. Москва, ул. Поставщика, д. 1',
    loading_datetime: '2026-05-15 09:00',
    delivery_datetime_estimate: '2026-05-15 14:00',
  },
  branch: {
    short_name: 'КУ-МОСКВА-1',
  },
}
