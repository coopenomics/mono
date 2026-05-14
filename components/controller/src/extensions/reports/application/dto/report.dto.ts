import { ObjectType, Field, InputType, Int, Float, registerEnumType } from '@nestjs/graphql';
import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  IsIn,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType, ReportPeriodType } from '../../domain/enums/report-type.enum';

registerEnumType(ReportType, { name: 'ReportType' });
registerEnumType(ReportPeriodType, { name: 'ReportPeriodType' });

@ObjectType('AvailableReport')
export class AvailableReportDTO {
  @Field(() => ReportType)
  type!: ReportType;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  period!: string;

  @Field(() => String)
  deadline!: string;

  @Field(() => Date, { nullable: true, description: 'Время последней успешной генерации (UTC)' })
  lastGeneratedAt?: Date;

  @Field(() => Date, { nullable: true, description: 'Ближайшая дата подачи в ФНС/СФР' })
  nextDeadlineDate?: Date;

  @Field(() => Boolean, { description: 'Готовы ли реквизиты для генерации этой формы' })
  readyToGenerate!: boolean;

  @Field(() => [String], { description: 'Ключи недостающих полей (пусто, если ready=true)' })
  missingFields!: string[];
}

@ObjectType('ReportPreviewField')
export class ReportPreviewFieldDTO {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String, { nullable: true })
  value?: string;

  @Field(() => String, { nullable: true })
  unit?: string;
}

@ObjectType('ReportPreviewSection')
export class ReportPreviewSectionDTO {
  @Field(() => String)
  title!: string;

  @Field(() => [ReportPreviewFieldDTO])
  fields!: ReportPreviewFieldDTO[];
}

@ObjectType('ReportPreview')
export class ReportPreviewDTO {
  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  year!: number;

  @Field(() => Int, { nullable: true })
  period?: number;

  @Field(() => [ReportPreviewSectionDTO])
  sections!: ReportPreviewSectionDTO[];
}

@InputType('ReportPreviewInput')
export class ReportPreviewInputDTO {
  @Field(() => ReportType)
  @IsEnum(ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(54)
  period?: number;
}

@InputType('BalanceCorrectionItemInput')
export class BalanceCorrectionItemInputDTO {
  @Field(() => String)
  @IsString()
  accountDisplayId!: string;

  @Field(() => Float)
  @IsNumber()
  balancePrevious!: number;

  @Field(() => Float)
  @IsNumber()
  balancePrePrevious!: number;
}

@InputType('GenerateReportInput')
export class GenerateReportInputDTO {
  @Field(() => ReportType)
  @IsEnum(ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(54)
  period?: number;

  @Field(() => Int, { nullable: true, description: 'Номер корректировки декларации (0 — первичная)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  correctionNumber?: number;

  @Field(() => [BalanceCorrectionItemInputDTO], {
    nullable: true,
    description: 'Ручные корректировки балансов прошлых периодов (для BUHOTCH)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BalanceCorrectionItemInputDTO)
  corrections?: BalanceCorrectionItemInputDTO[];
}

/**
 * OrganizationDataInput — опциональный override реквизитов при вызове
 * generateReport. Если не передан, резолвер берёт merged-view из
 * getReportRequisites (ончейн + ручные). Поэтому **все** поля здесь
 * опциональны: IsOptional + паттерн-валидация применяется только если
 * поле действительно передано. Раньше inn/kpp/… были required (@IsNotEmpty),
 * и при вызове без organization pipe всё равно валидировал null как
 * отсутствующие значения — выдавал «inn should not be empty» и т.д.
 */
@InputType('OrganizationDataInput')
export class OrganizationDataInputDTO {
  // ИНН юрлица = 10 цифр, ИП = 12 цифр. Принимаем обе длины.
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{10}|\d{12})$/, { message: 'ИНН должен быть 10 или 12 цифр' })
  inn?: string;

  // XSD ФНС: КПП = 9 симв., позиции 5-6 могут быть A-Z (иностранные
  // организации). Упрощённо: 4 цифры + 2 буквы/цифры + 3 цифры.
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}[0-9A-Z]{2}\d{3}$/, { message: 'КПП — 9 символов (4 цифры + 2 [0-9A-Z] + 3 цифры)' })
  kpp?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  orgName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{13}|\d{15})$/, { message: 'ОГРН — 13 цифр, ОГРНИП — 15' })
  ogrn?: string;

  @Field(() => String, { nullable: true, description: 'ОКВЭД — напр. 94.99, 46.73.7' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}(\.\d{1,2}){0,2}$/, { message: 'ОКВЭД — XX, XX.X, XX.XX, XX.XX.X или XX.XX.XX' })
  okved?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}(\d{3})?$/, { message: 'ОКТМО — 8 или 11 цифр' })
  oktmo?: string;

  @Field(() => String, { nullable: true, description: 'ОКФС — 1-3 цифры' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'ОКФС — 1-3 цифры' })
  okfs?: string;

  @Field(() => String, { nullable: true, description: 'ОКОПФ — 5 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'ОКОПФ — 5 цифр' })
  okopf?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  // ОКПО в XSD ФНС — ровно 10 цифр (pattern [0-9]{10}, maxLength 10).
  // По ГОСТу допускается 8 (юрлица) или 10 (филиалы/ИП); ФНС принимает 10 —
  // для юрлиц с 8 добавляются 2 нуля слева. Ограничиваем обе формы.
  @Field(() => String, { nullable: true, description: 'ОКПО — 8 или 10 цифр (ФНС принимает 10)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}(\d{2})?$/, { message: 'ОКПО — 8 или 10 цифр' })
  okpo?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signerLastName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signerFirstName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signerMiddleName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Тип подписанта: "chairman" (ПрПодп=1) или "representative" (ПрПодп=2)',
  })
  @IsOptional()
  @IsIn(['chairman', 'representative'])
  signerType?: 'chairman' | 'representative';

  @Field(() => String, {
    nullable: true,
    description: 'Для signerType=representative — описание доверенности (НаимДок в <СвПред>)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  signerRepDoc?: string;

  @Field(() => String, { nullable: true, description: 'СНИЛС — XXX-XXX-XXX YY или 11 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{3}-\d{3}-\d{3} \d{2}|\d{11})$/, { message: 'СНИЛС — XXX-XXX-XXX YY или 11 цифр' })
  signerSnils?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Регистрационный номер страхователя в СФР — XXX-XXX-XXXXXX',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{3}-\d{3}-\d{6}$/, { message: 'Рег. номер СФР — XXX-XXX-XXXXXX (14 симв.)' })
  sfrRegNumber?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Должность руководителя, указывается в ЕФС-1 (по умолчанию «Председатель Совета»)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chairmanPosition?: string;
}

@ObjectType('GeneratedReport')
export class GeneratedReportDTO {
  @Field(() => String, { nullable: true, description: 'UUID записи в generated_reports (null, если XML пустой и не сохранён)' })
  id?: string;

  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  year!: number;

  @Field(() => Int, { nullable: true })
  period?: number;

  @Field(() => String)
  xml!: string;

  @Field(() => String)
  fileName!: string;

  @Field(() => [String])
  errors!: string[];

  @Field(() => Boolean)
  isValid!: boolean;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;
}

@InputType('ReportHistoryFilterInput')
export class ReportHistoryFilterInputDTO {
  @Field(() => ReportType, { nullable: true })
  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(54)
  period?: number;

  @Field(() => Int, { nullable: true, description: 'Лимит (макс 100, по умолчанию 20)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, description: 'Сдвиг для пагинации (по умолчанию 0)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

@ObjectType('ReportHistoryPage')
export class ReportHistoryPageDTO {
  @Field(() => [GeneratedReportSummaryDTO])
  items!: GeneratedReportSummaryDTO[];

  @Field(() => Int)
  total!: number;
}

@ObjectType('GeneratedReportSummary')
export class GeneratedReportSummaryDTO {
  @Field(() => String)
  id!: string;

  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  year!: number;

  @Field(() => Int, { nullable: true })
  period?: number;

  @Field(() => String)
  fileName!: string;

  @Field(() => Boolean)
  isValid!: boolean;

  @Field(() => String)
  generatedBy!: string;

  @Field(() => Date)
  createdAt!: Date;
}
