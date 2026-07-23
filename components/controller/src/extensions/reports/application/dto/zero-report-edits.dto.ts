import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  INN_UL_PATTERN,
  KPP_PATTERN,
  OGRN_UL_PATTERN,
  OKFS_PATTERN,
  OKOPF_PATTERN,
  OKPO_PATTERN,
  OKTMO_PATTERN,
  OKVED_PATTERN,
  SFR_REG_NUMBER_PATTERN,
  PFR_REG_NUMBER_PATTERN,
  SNILS_PATTERN,
  DATE_DDMMYYYY_PATTERN,
} from '../../domain/patterns';

/**
 * DTO для «нулёвок»: NDFL6, RSV, PSV, DUSN, UUSN, FSS4/ЕФС-1.
 * Структура — зеркало `ZeroReportEditsShape` (edits-shape из domain/).
 * Все суммы в XML хардкодятся генератором (0), здесь редактируются только
 * реквизиты + подписант + period/год/корректировка.
 */

enum ZeroSignerType {
  CHAIRMAN = 'chairman',
  REPRESENTATIVE = 'representative',
}

registerEnumType(ZeroSignerType, {
  name: 'ZeroReportSignerType',
  description: 'Тип подписанта для нулевых форм: руководитель или представитель',
});

// =============================================================
// Header
// =============================================================

@InputType('ZeroReportHeaderEditsInput')
export class ZeroReportHeaderEditsInputDTO {
  @Field(() => String)
  @IsString()
  idFile!: string;

  @Field(() => String)
  @IsString()
  @Length(1, 40)
  versProgram!: string;

  @Field(() => String)
  @Matches(DATE_DDMMYYYY_PATTERN, { message: 'ДатаДок — DD.MM.YYYY' })
  docDate!: string;

  @Field(() => Int)
  @IsInt()
  @Min(2000)
  @Max(2100)
  reportYear!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(12)
  period!: number | null;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(999)
  correctionNumber!: number;
}

@ObjectType('ZeroReportHeaderEdits')
export class ZeroReportHeaderEditsDTO {
  @Field(() => String) idFile!: string;
  @Field(() => String) versProgram!: string;
  @Field(() => String) docDate!: string;
  @Field(() => Int) reportYear!: number;
  @Field(() => Int, { nullable: true }) period!: number | null;
  @Field(() => Int) correctionNumber!: number;
}

// =============================================================
// Organization
// =============================================================

@InputType('ZeroReportOrganizationEditsInput')
export class ZeroReportOrganizationEditsInputDTO {
  @Field(() => String)
  @IsString()
  @Length(1, 1000)
  orgName!: string;

  @Field(() => String)
  @Matches(INN_UL_PATTERN, { message: 'ИНН ЮЛ — 10 цифр' })
  inn!: string;

  @Field(() => String)
  @Matches(KPP_PATTERN, { message: 'КПП — 9 символов' })
  kpp!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKTMO_PATTERN, { message: 'ОКТМО — 8 или 11 цифр' })
  oktmo!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKVED_PATTERN, { message: 'ОКВЭД — XX, XX.X, XX.XX, XX.XX.X или XX.XX.XX' })
  okved!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKFS_PATTERN, { message: 'ОКФС — 1-3 цифры' })
  okfs!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKOPF_PATTERN, { message: 'ОКОПФ — 5 цифр' })
  okopf!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKPO_PATTERN, { message: 'ОКПО — 8 или 10 цифр' })
  okpo!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OGRN_UL_PATTERN, { message: 'ОГРН ЮЛ — 13 цифр' })
  ogrn!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address!: string | null;
}

@ObjectType('ZeroReportOrganizationEdits')
export class ZeroReportOrganizationEditsDTO {
  @Field(() => String) orgName!: string;
  @Field(() => String) inn!: string;
  @Field(() => String) kpp!: string;
  @Field(() => String, { nullable: true }) oktmo!: string | null;
  @Field(() => String, { nullable: true }) okved!: string | null;
  @Field(() => String, { nullable: true }) okfs!: string | null;
  @Field(() => String, { nullable: true }) okopf!: string | null;
  @Field(() => String, { nullable: true }) okpo!: string | null;
  @Field(() => String, { nullable: true }) ogrn!: string | null;
  @Field(() => String, { nullable: true }) address!: string | null;
}

// =============================================================
// Signer
// =============================================================

@InputType('ZeroReportSignerEditsInput')
export class ZeroReportSignerEditsInputDTO {
  @Field(() => ZeroSignerType)
  @IsEnum(ZeroSignerType)
  type!: ZeroSignerType;

  @Field(() => String)
  @IsString()
  @Length(1, 60)
  lastName!: string;

  @Field(() => String)
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  middleName!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  repDoc!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(SNILS_PATTERN, { message: 'СНИЛС — XXX-XXX-XXX YY или 11 цифр' })
  snils!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(SFR_REG_NUMBER_PATTERN, { message: 'Рег.номер СФР — 10 цифр' })
  sfrRegNumber!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(PFR_REG_NUMBER_PATTERN, { message: 'Рег.номер ПФР — XXX-XXX-XXXXXX' })
  pfrRegNumber!: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  chairmanPosition!: string | null;
}

@ObjectType('ZeroReportSignerEdits')
export class ZeroReportSignerEditsDTO {
  @Field(() => ZeroSignerType) type!: ZeroSignerType;
  @Field(() => String) lastName!: string;
  @Field(() => String) firstName!: string;
  @Field(() => String, { nullable: true }) middleName!: string | null;
  @Field(() => String, { nullable: true }) repDoc!: string | null;
  @Field(() => String, { nullable: true }) snils!: string | null;
  @Field(() => String, { nullable: true }) sfrRegNumber!: string | null;
  @Field(() => String, { nullable: true }) pfrRegNumber!: string | null;
  @Field(() => String, { nullable: true }) chairmanPosition!: string | null;
}

// =============================================================
// Root
// =============================================================

@InputType('ZeroReportEditsInput')
export class ZeroReportEditsInputDTO {
  @Field(() => ZeroReportHeaderEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportHeaderEditsInputDTO)
  header!: ZeroReportHeaderEditsInputDTO;

  @Field(() => ZeroReportOrganizationEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportOrganizationEditsInputDTO)
  organization!: ZeroReportOrganizationEditsInputDTO;

  @Field(() => ZeroReportSignerEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportSignerEditsInputDTO)
  signer!: ZeroReportSignerEditsInputDTO;
}

@ObjectType('ZeroReportEdits')
export class ZeroReportEditsDTO {
  @Field(() => ZeroReportHeaderEditsDTO) header!: ZeroReportHeaderEditsDTO;
  @Field(() => ZeroReportOrganizationEditsDTO) organization!: ZeroReportOrganizationEditsDTO;
  @Field(() => ZeroReportSignerEditsDTO) signer!: ZeroReportSignerEditsDTO;
}

export { ZeroSignerType as ZeroReportSignerTypeEnum };
