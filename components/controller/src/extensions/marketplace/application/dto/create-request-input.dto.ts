import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber, IsArray, IsEnum, IsNotEmpty, Min, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Регистрируем enum для GraphQL
export enum RequestTypeInput {
  OFFER = 'offer',
  ORDER = 'order',
}

export enum RequestImageTypeInput {
  REGULAR = 'regular',
  PRIMARY = 'primary',
  COLOR_SAMPLE = 'color_sample',
  IMAGE_360 = 'image_360',
}

registerEnumType(RequestTypeInput, {
  name: 'RequestTypeInput',
  description: 'Тип заявки: offer - предложение, order - заказ',
});

registerEnumType(RequestImageTypeInput, {
  name: 'RequestImageTypeInput',
  description: 'Тип изображения заявки',
});

/**
 * Input для атрибута заявки
 */
@InputType()
export class RequestAttributeInput {
  @Field(() => Int, { description: 'ID атрибута' })
  @IsNumber()
  attributeId!: number;

  @Field({ description: 'Значение атрибута' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @Field(() => Int, { description: 'ID комплексного атрибута', nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  complexId?: number;

  @Field(() => Int, { description: 'ID значения из словаря', nullable: true })
  @IsOptional()
  @IsNumber()
  dictionaryValueId?: number;
}

/**
 * Input для изображения заявки
 */
@InputType()
export class RequestImageInput {
  @Field({ description: 'URL изображения' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'Некорректный URL изображения' })
  imageUrl!: string;

  @Field(() => RequestImageTypeInput, { description: 'Тип изображения', defaultValue: RequestImageTypeInput.REGULAR })
  @IsEnum(RequestImageTypeInput)
  imageType!: RequestImageTypeInput;

  @Field(() => Int, { description: 'Порядок сортировки', defaultValue: 0 })
  @IsNumber()
  @Min(0)
  sortOrder!: number;

  @Field({ description: 'Описание изображения', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Input для создания заявки
 */
@InputType()
export class CreateRequestInput {
  @Field({ description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => RequestTypeInput, { description: 'Тип заявки: offer - предложение, order - заказ' })
  @IsEnum(RequestTypeInput)
  type!: RequestTypeInput;

  // Основная информация о товаре
  @Field({ description: 'Название товара (до 500 символов)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ description: 'Артикул товара (до 50 символов)' })
  @IsString()
  @IsNotEmpty()
  articleNumber!: string;

  @Field({ description: 'Штрихкод товара', nullable: true })
  @IsOptional()
  @IsString()
  barcode?: string;

  // Категория и тип
  @Field(() => Int, { description: 'ID категории' })
  @IsNumber()
  descriptionCategoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  @IsNumber()
  typeId!: number;

  // Цены
  @Field(() => Number, { description: 'Цена товара' })
  @IsNumber()
  @Min(0.01)
  price!: number;

  @Field(() => Number, { description: 'Цена до скидки', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  oldPrice?: number;

  @Field({ description: 'Валюта', defaultValue: 'RUB' })
  @IsString()
  @IsNotEmpty()
  currencyCode!: string;

  @Field({ description: 'Ставка НДС (0, 0.05, 0.07, 0.1, 0.2)' })
  @IsString()
  @IsNotEmpty()
  vat!: string;

  // Габариты и вес
  @Field(() => Int, { description: 'Ширина упаковки', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @Field(() => Int, { description: 'Высота упаковки', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;

  @Field(() => Int, { description: 'Глубина упаковки', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  depth?: number;

  @Field({ description: 'Единица измерения габаритов', nullable: true, defaultValue: 'mm' })
  @IsOptional()
  @IsString()
  dimensionUnit?: string;

  @Field(() => Int, { description: 'Вес товара', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  weight?: number;

  @Field({ description: 'Единица измерения веса', nullable: true, defaultValue: 'g' })
  @IsOptional()
  @IsString()
  weightUnit?: string;

  // Количества
  @Field(() => Int, { description: 'Количество единиц товара' })
  @IsNumber()
  @Min(1)
  units!: number;

  // Время жизни и гарантии
  @Field(() => Int, { description: 'Время жизни продукта в секундах', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  productLifecycleSecs?: number;

  @Field(() => Int, { description: 'Гарантийный срок в днях', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  warrantyDays?: number;

  // Дополнительные данные
  @Field({ description: 'Дополнительные данные JSON', nullable: true })
  @IsOptional()
  @IsString()
  data?: string;

  @Field({ description: 'Метаданные JSON', nullable: true })
  @IsOptional()
  @IsString()
  meta?: string;

  // Атрибуты и изображения
  @Field(() => [RequestAttributeInput], { description: 'Атрибуты товара', defaultValue: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestAttributeInput)
  attributes!: RequestAttributeInput[];

  @Field(() => [RequestImageInput], { description: 'Изображения товара', defaultValue: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestImageInput)
  images!: RequestImageInput[];

  // URL изображений
  @Field({ description: 'URL главного изображения', nullable: true })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Некорректный URL главного изображения' })
  primaryImageUrl?: string;

  @Field({ description: 'URL образца цвета', nullable: true })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Некорректный URL образца цвета' })
  colorImageUrl?: string;

  // Геоограничения
  @Field(() => [String], { description: 'Геоограничения', defaultValue: [] })
  @IsArray()
  @IsString({ each: true })
  geoNames!: string[];

  // Родительская заявка
  @Field({ description: 'Хэш родительской заявки', nullable: true })
  @IsOptional()
  @IsString()
  parentHash?: string;
}
