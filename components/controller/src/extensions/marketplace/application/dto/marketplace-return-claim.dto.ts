import {
  Field,
  Float,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import GraphQLJSON from 'graphql-type-json';
import {
  MarketplaceReturnClaimDefectCategories,
  MarketplaceReturnClaimExpectedResolutions,
  MarketplaceReturnClaimStatuses,
  type MarketplaceReturnClaimDefectCategory,
  type MarketplaceReturnClaimExpectedResolution,
  type MarketplaceReturnClaimStatus,
} from '../../domain/entities/marketplace-return-claim.types';
import { MarketplaceReturnStatementSignedInputDTO } from '~/application/document/documents-dto/marketplace-return-statement-document.dto';
import { MarketplaceUnitOfMeasureEnum } from './marketplace-offer.dto';

/**
 * Эпик 7: GraphQL enum'ы статуса заявления и категории дефекта. Регистрируются
 * через `registerEnumType` чтобы strict-TypeScript на клиенте получал
 * именованные значения, а не строки (правило `feedback_graphql_enum_not_strings`).
 */
export enum MarketplaceReturnClaimStatusEnum {
  PENDING_CHAIRMAN_REVIEW = 'PENDING_CHAIRMAN_REVIEW',
  APPROVED_FOR_VISIT = 'APPROVED_FOR_VISIT',
  REJECTED_REMOTELY = 'REJECTED_REMOTELY',
  ACCEPTED_AT_VISIT = 'ACCEPTED_AT_VISIT',
  REJECTED_AT_VISIT = 'REJECTED_AT_VISIT',
}

registerEnumType(MarketplaceReturnClaimStatusEnum, {
  name: 'MarketplaceReturnClaimStatus',
  description: 'Состояние заявления на гарантийный возврат имущества пайщика.',
});

export enum MarketplaceReturnClaimDefectCategoryEnum {
  BROKEN = 'BROKEN',
  EXPIRED = 'EXPIRED',
  NOT_AS_DESCRIBED = 'NOT_AS_DESCRIBED',
  WRONG_ITEM = 'WRONG_ITEM',
  OTHER = 'OTHER',
}

registerEnumType(MarketplaceReturnClaimDefectCategoryEnum, {
  name: 'MarketplaceReturnClaimDefectCategory',
  description: 'Категория дефекта, на который ссылается заявление на возврат.',
});

export enum MarketplaceReturnClaimExpectedResolutionEnum {
  FUNDS_RETURN = 'FUNDS_RETURN',
}

registerEnumType(MarketplaceReturnClaimExpectedResolutionEnum, {
  name: 'MarketplaceReturnClaimExpectedResolution',
  description: 'Желаемый исход возврата (в MVP — только восстановление средств на программном кошельке).',
});

export const MARKETPLACE_RETURN_CLAIM_STATUS_VALUES = MarketplaceReturnClaimStatuses;
export const MARKETPLACE_RETURN_CLAIM_DEFECT_CATEGORY_VALUES = MarketplaceReturnClaimDefectCategories;
export const MARKETPLACE_RETURN_CLAIM_EXPECTED_RESOLUTION_VALUES =
  MarketplaceReturnClaimExpectedResolutions;

@InputType('MarketplaceReturnClaimPhotoUploadInput')
export class MarketplaceReturnClaimPhotoUploadInputDTO {
  @Field({ description: 'Содержимое файла, закодированное в base64.' })
  @IsString()
  @IsNotEmpty()
  public readonly base64!: string;

  @Field({ description: 'MIME-тип фото (image/jpeg, image/png либо image/webp).' })
  @IsString()
  @IsNotEmpty()
  public readonly mime_type!: string;
}

@InputType('MarketplaceCreateReturnClaimInput')
export class MarketplaceCreateReturnClaimInputDTO {
  @Field(() => String, { description: 'Заказ, по которому подаётся заявление.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field({ description: 'Текст обращения пайщика (1-500 символов).' })
  @IsString()
  @IsNotEmpty()
  public readonly reason_text!: string;

  @Field(() => MarketplaceReturnClaimDefectCategoryEnum, {
    nullable: true,
    description: 'Категория дефекта (опционально).',
  })
  @IsOptional()
  @IsEnum(MarketplaceReturnClaimDefectCategoryEnum)
  public readonly defect_category?: MarketplaceReturnClaimDefectCategory;

  @Field(() => Float, {
    nullable: true,
    description: 'Возвращаемое количество единиц (по умолчанию — выданное количество).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  public readonly actual_quantity?: number;

  @Field(() => MarketplaceReturnStatementSignedInputDTO, {
    description: 'Подписанное пайщиком заявление о гарантийном возврате имущества (реестр документов 1104).',
  })
  @ValidateNested()
  @Type(() => MarketplaceReturnStatementSignedInputDTO)
  public readonly signed_statement!: MarketplaceReturnStatementSignedInputDTO;

  @Field(() => [MarketplaceReturnClaimPhotoUploadInputDTO], {
    description: 'Фотографии товара — обязательно от 1 до 10 файлов.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceReturnClaimPhotoUploadInputDTO)
  public readonly photos!: MarketplaceReturnClaimPhotoUploadInputDTO[];
}

@InputType('MarketplaceReturnClaimSignablePayloadInput')
export class MarketplaceReturnClaimSignablePayloadInputDTO {
  @Field(() => String, { description: 'Идентификатор заказа, по которому готовится заявление.' })
  @IsString()
  @IsNotEmpty()
  public readonly order_id!: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Возвращаемое количество (если не указано — выданное количество).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  public readonly actual_quantity?: number;

  @Field({
    nullable: true,
    description: 'Причина обращения, как её сформулировал пайщик (попадает в текст заявления).',
  })
  @IsOptional()
  @IsString()
  public readonly reason_text?: string;

  @Field(() => MarketplaceReturnClaimDefectCategoryEnum, {
    nullable: true,
    description: 'Категория дефекта (опционально, дублируется в meta документа).',
  })
  @IsOptional()
  @IsEnum(MarketplaceReturnClaimDefectCategoryEnum)
  public readonly defect_category?: MarketplaceReturnClaimDefectCategory;
}

@InputType('MarketplaceApproveReturnVisitInput')
export class MarketplaceApproveReturnVisitInputDTO {
  @Field(() => String, { description: 'Идентификатор заявления.' })
  @IsString()
  public readonly claim_id!: string;

  @Field({ description: 'Кооперативный участок, на который приглашаем пайщика.' })
  @IsString()
  public readonly braname!: string;

  @Field({
    nullable: true,
    description: 'Комментарий председателя (опционально при приглашении на осмотр, до 500 символов).',
  })
  @IsOptional()
  @IsString()
  public readonly comment?: string;
}

@InputType('MarketplaceRejectReturnRemoteInput')
export class MarketplaceRejectReturnRemoteInputDTO {
  @Field(() => String, { description: 'Идентификатор заявления.' })
  @IsString()
  public readonly claim_id!: string;

  @Field({ description: 'Кооперативный участок, под чьей юрисдикцией решение.' })
  @IsString()
  public readonly braname!: string;

  @Field({ description: 'Причина отказа (обязательно, 1-500 символов).' })
  @IsString()
  @IsNotEmpty()
  public readonly comment!: string;
}

@InputType('MarketplaceAcceptReturnAtVisitInput')
export class MarketplaceAcceptReturnAtVisitInputDTO {
  @Field(() => String, { description: 'Идентификатор заявления.' })
  @IsString()
  public readonly claim_id!: string;

  @Field({ description: 'Кооперативный участок, где идёт очный осмотр.' })
  @IsString()
  public readonly braname!: string;

  @Field({
    description: 'Результат очного осмотра (обязательно, до 2000 символов).',
  })
  @IsString()
  @IsNotEmpty()
  public readonly inspection_result!: string;

  @Field({
    nullable: true,
    description: 'Сканированный штрих-код имущества для сверки с заказом (если применимо).',
  })
  @IsOptional()
  @IsString()
  public readonly scanned_barcode?: string;

  @Field(() => [MarketplaceReturnClaimPhotoUploadInputDTO], {
    nullable: true,
    description: 'Фото очного осмотра (опционально, до 10 файлов).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceReturnClaimPhotoUploadInputDTO)
  public readonly inspection_photos?: MarketplaceReturnClaimPhotoUploadInputDTO[];

  @Field(() => MarketplaceReturnStatementSignedInputDTO, {
    nullable: true,
    description:
      'Заявление пайщика со второй подписью председателя — принятие возврата оформляется со-подписью на том же документе.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplaceReturnStatementSignedInputDTO)
  public readonly signed_statement?: MarketplaceReturnStatementSignedInputDTO;
}

@InputType('MarketplaceRejectReturnAtVisitInput')
export class MarketplaceRejectReturnAtVisitInputDTO {
  @Field(() => String, { description: 'Идентификатор заявления.' })
  @IsString()
  public readonly claim_id!: string;

  @Field({ description: 'Кооперативный участок, где идёт очный осмотр.' })
  @IsString()
  public readonly braname!: string;

  @Field({ description: 'Результат и причина отказа (обязательно, до 2000 символов).' })
  @IsString()
  @IsNotEmpty()
  public readonly inspection_result!: string;

  @Field(() => [MarketplaceReturnClaimPhotoUploadInputDTO], {
    nullable: true,
    description: 'Фото очного осмотра (опционально).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MarketplaceReturnClaimPhotoUploadInputDTO)
  public readonly inspection_photos?: MarketplaceReturnClaimPhotoUploadInputDTO[];
}

@InputType('MarketplaceListReturnClaimsByBranameInput')
export class MarketplaceListReturnClaimsByBranameInputDTO {
  @Field({ description: 'Кооперативный участок (delivery_braname исходного заказа).' })
  @IsString()
  public readonly delivery_braname!: string;
}

/* ── Output types ─────────────────────────────────────────────────────── */

@ObjectType('MarketplaceReturnClaimPhoto', {
  description: 'Снапшот фото-доказательства, приложенного к заявлению на возврат.',
})
export class MarketplaceReturnClaimPhotoDTO {
  @Field({
    description: 'Подписанный URL для чтения фото из bucket\'а stol-zakazov:images.',
  })
  public readonly url!: string;

  @Field({ description: 'Sha256-хеш содержимого фото (используется как анкер on-chain).' })
  public readonly content_hash!: string;

  @Field({ description: 'MIME-тип файла.' })
  public readonly mime_type!: string;

  @Field({ description: 'Время загрузки фото в bucket.' })
  public readonly uploaded_at!: Date;
}

@ObjectType('MarketplaceReturnClaimDecisionEntry', {
  description: 'Запись о решении председателя по заявлению на возврат.',
})
export class MarketplaceReturnClaimDecisionEntryDTO {
  @Field({ description: 'Стадия решения: «remote» — удалённое, «on_site» — очный осмотр.' })
  public readonly stage!: string;

  @Field({ description: 'Тип решения: approve_visit / reject_remote / accept_at_visit / reject_at_visit.' })
  public readonly decision!: string;

  @Field({ description: 'Аккаунт председателя, принявшего решение.' })
  public readonly by_chairman_account!: string;

  @Field({ description: 'Кооперативный участок, под чьей юрисдикцией решение.' })
  public readonly braname!: string;

  @Field({ description: 'Комментарий / причина / результат осмотра.' })
  public readonly comment!: string;

  @Field({ description: 'Время фиксации решения.' })
  public readonly at!: Date;

  @Field({ description: 'Хэш транзакции в блокчейне для аудита решения.' })
  public readonly tx_hash!: string;
}

@ObjectType('MarketplaceReturnClaimOnSiteInspection', {
  description: 'Параметры очного осмотра имущества председателем КУ.',
})
export class MarketplaceReturnClaimOnSiteInspectionDTO {
  @Field({ description: 'Текстовое описание результатов осмотра.' })
  public readonly result_text!: string;

  @Field(() => [MarketplaceReturnClaimPhotoDTO], { description: 'Фото очного осмотра.' })
  public readonly photos!: MarketplaceReturnClaimPhotoDTO[];

  @Field({ nullable: true, description: 'Сканированный штрих-код имущества (если применимо).' })
  public readonly scanned_barcode?: string;

  @Field({ description: 'Председатель, проводивший очный осмотр.' })
  public readonly by_chairman_account!: string;

  @Field({ description: 'Время очного осмотра.' })
  public readonly at!: Date;
}

@ObjectType('MarketplaceReturnClaimLedgerSnapshot', {
  description: 'Снапшот compensating-forward пары после успешного приёма возврата.',
})
export class MarketplaceReturnClaimLedgerSnapshotDTO {
  @Field({ description: 'Сумма compensating-forward (восстановленная на программный кошелёк).' })
  public readonly amount!: string;

  @Field(() => Float, { description: 'Возвращённое количество единиц имущества.' })
  public readonly returned_quantity!: number;

  @Field({ description: 'Хэш транзакции accretrn в блокчейне.' })
  public readonly tx_hash!: string;

  @Field({ description: 'Время фиксации возврата.' })
  public readonly at!: Date;
}

@ObjectType('MarketplaceReturnClaim', {
  description: 'Заявление пайщика на гарантийный возврат имущества (Эпик 7).',
})
export class MarketplaceReturnClaimDTO {
  @Field(() => String) public readonly id!: string;
  @Field() public readonly coopname!: string;
  @Field({ description: 'Якорный hash on-chain return_request.' })
  public readonly request_hash!: string;

  @Field() public readonly order_id!: string;
  @Field() public readonly order_hash!: string;

  @Field(() => String, { nullable: true, description: 'Наименование товара исходного заказа.' })
  public readonly product_name!: string | null;

  @Field(() => MarketplaceUnitOfMeasureEnum, { nullable: true, description: 'Базовая единица измерения товара (штука, килограмм, литр).' })
  public readonly unit_of_measure!: MarketplaceUnitOfMeasureEnum | null;

  @Field(() => Float, {
    nullable: true,
    description:
      'Содержимое одной упаковки в базовой единице (Эпик 18, отпуск упаковкой). Null/0 — отпуск по мере.',
  })
  public readonly package_size!: number | null;

  @Field({ description: 'Аккаунт пайщика-заявителя.' })
  public readonly orderer_account!: string;

  @Field(() => String, { nullable: true, description: 'ФИО (или наименование организации) пайщика-заявителя.' })
  public readonly orderer_name!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Гарантийный срок возврата исходного заказа (если установлен предложением).',
  })
  public readonly warranty_until!: Date | null;

  @Field({ description: 'КУ доставки исходного заказа (куда подаётся заявление).' })
  public readonly delivery_braname!: string;

  @Field({ description: 'Поставщик исходного заказа (для будущего возврата поставщику).' })
  public readonly supplier_account!: string;

  @Field(() => MarketplaceReturnClaimStatusEnum, { description: 'Текущий статус заявления.' })
  public readonly status!: MarketplaceReturnClaimStatus;

  @Field({ description: 'Текст обращения пайщика.' })
  public readonly reason_text!: string;

  @Field(() => MarketplaceReturnClaimDefectCategoryEnum, {
    nullable: true,
    description: 'Категория дефекта (если указана).',
  })
  public readonly defect_category!: MarketplaceReturnClaimDefectCategory | null;

  @Field(() => MarketplaceReturnClaimExpectedResolutionEnum)
  public readonly expected_resolution!: MarketplaceReturnClaimExpectedResolution;

  @Field(() => Float) public readonly actual_quantity!: number;
  @Field({ description: 'Возвращаемая стоимость имущества.' })
  public readonly fact_cost!: string;

  @Field({ description: 'Возвращаемая часть членского взноса, уплаченного за это имущество.' })
  public readonly fee_refund!: string;

  @Field({ description: 'Полная сумма к возврату пайщику: стоимость имущества вместе с членским взносом.' })
  public readonly total_refund!: string;

  @Field(() => [MarketplaceReturnClaimPhotoDTO], { description: 'Фотографии товара, приложенные пайщиком.' })
  public readonly photos!: MarketplaceReturnClaimPhotoDTO[];

  @Field({ description: 'Хэш транзакции submretrn в блокчейне.' })
  public readonly submretrn_tx_hash!: string;

  @Field(() => [MarketplaceReturnClaimDecisionEntryDTO])
  public readonly decision_log!: MarketplaceReturnClaimDecisionEntryDTO[];

  @Field(() => MarketplaceReturnClaimOnSiteInspectionDTO, {
    nullable: true,
    description: 'Параметры очного осмотра (заполняется на стадии accept/reject_at_visit).',
  })
  public readonly on_site_inspection!: MarketplaceReturnClaimOnSiteInspectionDTO | null;

  @Field(() => MarketplaceReturnClaimLedgerSnapshotDTO, {
    nullable: true,
    description: 'Снапшот compensating-forward (только при ACCEPTED_AT_VISIT).',
  })
  public readonly ledger_snapshot!: MarketplaceReturnClaimLedgerSnapshotDTO | null;

  @Field() public readonly created_at!: Date;
  @Field() public readonly updated_at!: Date;
}

@ObjectType('MarketplaceReturnClaimResult', {
  description: 'Результат любого изменения статуса заявления на гарантийный возврат.',
})
export class MarketplaceReturnClaimResultDTO {
  @Field(() => MarketplaceReturnClaimDTO, { description: 'Актуальное состояние заявления.' })
  public readonly claim!: MarketplaceReturnClaimDTO;

  @Field({ description: 'Хэш транзакции в блокчейне последнего действия.' })
  public readonly tx_hash!: string;
}

@ObjectType('MarketplaceReturnClaimSignablePayload', {
  description:
    'Preview подписываемого заявления на возврат: HTML + meta + hash для подписи на клиенте.',
})
export class MarketplaceReturnClaimSignablePayloadDTO {
  @Field() public readonly full_title!: string;
  @Field() public readonly html!: string;
  @Field() public readonly hash!: string;
  @Field(() => GraphQLJSON, { description: 'Метаинформация документа.' })
  public readonly meta!: unknown;
}
