// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export type CatalogOfferStatus = 'draft' | 'published' | 'paused' | 'sold-out' | 'completed' | 'moderation' | 'withdrawn'

export interface CatalogOffer {
  id?: string | number
  title: string
  description?: string
  preview?: string         // URL одиночного изображения (legacy / обложка)
  images?: string[]        // URL'ы всех изображений — показываются каруселью
  remainUnits?: number
  unitCost?: number | string
  unitLabel?: string       // единица заказа: «100 г», «упаковка 8 шт», «шт»…
  referenceNote?: string   // справочная цена за базовую единицу «≈ 2500 ₽ за кг»
  status?: CatalogOfferStatus
  category?: string        // название категории — показывается над заголовком
  supplierName?: string    // ФИО / наименование поставщика
  coopStock?: boolean      // предложение кооператива со склада КУ — мгновенная выдача
}
