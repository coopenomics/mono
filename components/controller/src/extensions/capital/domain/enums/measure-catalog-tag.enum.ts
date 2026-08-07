import { registerEnumType } from '@nestjs/graphql';

/**
 * Категория меры в справочнике Благороста (для фильтра личное / кооп и т.п.).
 */
export enum MeasureCatalogTag {
  PERSONAL = 'personal',
  PRODUCT = 'product',
  CONTENT = 'content',
  COOPERATIVE = 'cooperative',
  QUALITY = 'quality',
}

registerEnumType(MeasureCatalogTag, {
  name: 'MeasureCatalogTag',
  description: 'Категория меры в справочнике',
  valuesMap: {
    PERSONAL: { description: 'Личное: тело и привычки' },
    PRODUCT: { description: 'Продукт и рост' },
    CONTENT: { description: 'Контент и охват' },
    COOPERATIVE: { description: 'Сообщество и кооператив' },
    QUALITY: { description: 'Операции и качество' },
  },
});
