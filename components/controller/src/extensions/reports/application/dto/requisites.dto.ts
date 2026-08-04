import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsString, IsIn, Matches, MaxLength } from 'class-validator';
import { ReportType } from '../../domain/enums/report-type.enum';
import { SFR_REG_NUMBER_PATTERN, PFR_REG_NUMBER_PATTERN } from '../../domain/patterns';

export enum RequisiteSource {
  DATABASE = 'database',
  MANUAL = 'manual',
  EMPTY = 'empty',
}

registerEnumType(RequisiteSource, { name: 'RequisiteSource' });

@ObjectType('RequisiteFieldView')
export class RequisiteFieldViewDTO {
  @Field(() => String, { nullable: true })
  value?: string | null;

  @Field(() => RequisiteSource)
  source!: RequisiteSource;
}

@ObjectType('ReportRequisitesView')
export class ReportRequisitesViewDTO {
  @Field(() => String)
  coopname!: string;

  // Поля из БД кооператива (source: 'database').
  @Field(() => RequisiteFieldViewDTO) inn!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) kpp!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) ogrn!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) orgName!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) address!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) phone!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerLastName!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerFirstName!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerMiddleName!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) chairmanPositionFromOrg!: RequisiteFieldViewDTO;

  // Ручные поля (source: 'manual').
  @Field(() => RequisiteFieldViewDTO) okved!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okfs!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okopf!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) oktmo!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okpo!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) sfrRegNumber!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) pfrRegNumber!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) chairmanPosition!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerSnils!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerRepDoc!: RequisiteFieldViewDTO;

  // Выбор пользователя — не RequisiteField (не связан с БД-источником).
  // Default 'chairman' проставляется сервисом, если председатель не сохранял.
  @Field(() => String, {
    description: 'Тип подписанта: "chairman" (ПрПодп=1) или "representative" (ПрПодп=2)',
  })
  signerType!: 'chairman' | 'representative';
}

/**
 * Валидация manual-полей соответствует XSD ФНС/СФР — единый источник
 * истины. Изменение XSD → изменение паттерна здесь.
 * Таблица соответствий:
 *   ОКВЭД   — `\d{2}(\.\d{1,2}){0,2}` (от 2 до 8 символов с точками)
 *   ОКФС    — `\d{1,3}`
 *   ОКОПФ   — `\d{5}`
 *   ОКТМО   — `\d{8}` или `\d{11}`
 *   ОКПО    — `\d{8}` или `\d{10}`
 *   СНИЛС   — `\d{3}-\d{3}-\d{3} \d{2}` (14 симв.) или 11 цифр подряд
 *   РегНом СФР — `\d{10}` (10 цифр подряд, без тире)
 *   РегНом ПФР — `\d{3}-\d{3}-\d{6}` (14 симв. с тире), только этот формат —
 *     отдельное поле от РегНом СФР, требуется для ЕФС-1 (внешние
 *     бухгалтерские системы сверяют его при приёме отчёта)
 */
@InputType('UpdateReportRequisitesInput')
export class UpdateReportRequisitesInputDTO {
  @Field(() => String, { nullable: true, description: 'ОКВЭД — напр. 94.99, 46.73.7' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}(\.\d{1,2}){0,2}$/, { message: 'ОКВЭД — XX, XX.X, XX.XX, XX.XX.X или XX.XX.XX' })
  okved?: string | null;

  @Field(() => String, { nullable: true, description: 'ОКФС — 1-3 цифры' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/, { message: 'ОКФС — 1-3 цифры' })
  okfs?: string | null;

  @Field(() => String, { nullable: true, description: 'ОКОПФ — 5 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'ОКОПФ — 5 цифр' })
  okopf?: string | null;

  @Field(() => String, { nullable: true, description: 'ОКТМО — 8 или 11 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}(\d{3})?$/, { message: 'ОКТМО — 8 или 11 цифр' })
  oktmo?: string | null;

  @Field(() => String, { nullable: true, description: 'ОКПО — 8 или 10 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}(\d{2})?$/, { message: 'ОКПО — 8 или 10 цифр' })
  okpo?: string | null;

  @Field(() => String, { nullable: true, description: 'Рег. номер СФР — 10 цифр' })
  @IsOptional()
  @IsString()
  @Matches(SFR_REG_NUMBER_PATTERN, { message: 'Рег. номер СФР — 10 цифр' })
  sfrRegNumber?: string | null;

  @Field(() => String, { nullable: true, description: 'Рег. номер ПФР — XXX-XXX-XXXXXX (для ЕФС-1, отдельно от рег. номера СФР)' })
  @IsOptional()
  @IsString()
  @Matches(PFR_REG_NUMBER_PATTERN, { message: 'Рег. номер ПФР — XXX-XXX-XXXXXX' })
  pfrRegNumber?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  chairmanPosition?: string | null;

  @Field(() => String, { nullable: true, description: 'СНИЛС — XXX-XXX-XXX YY или 11 цифр' })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{3}-\d{3}-\d{3} \d{2}|\d{11})$/, { message: 'СНИЛС — XXX-XXX-XXX YY или 11 цифр' })
  signerSnils?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  signerRepDoc?: string | null;

  @Field(() => String, { nullable: true, description: 'chairman | representative' })
  @IsOptional()
  @IsIn(['chairman', 'representative'])
  signerType?: 'chairman' | 'representative' | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phoneOverride?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  addressOverride?: string | null;
}

@ObjectType('MissingRequisiteField')
export class MissingRequisiteFieldDTO {
  @Field(() => String) key!: string;
  @Field(() => String) label!: string;
  @Field(() => String) reason!: string;
  @Field(() => RequisiteSource) source!: RequisiteSource;
}

@ObjectType('ReportReadinessView')
export class ReportReadinessViewDTO {
  @Field(() => ReportType) reportType!: ReportType;
  @Field(() => Boolean) ready!: boolean;
  @Field(() => [MissingRequisiteFieldDTO]) missingFields!: MissingRequisiteFieldDTO[];
}
