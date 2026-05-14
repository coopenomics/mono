import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  IsBoolean,
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
  OKFS_PATTERN,
  OKOPF_PATTERN,
  OKPO_PATTERN,
  DATE_DDMMYYYY_PATTERN,
} from '../../domain/patterns';

/**
 * Редактируемое состояние формы БУХОТЧ (КНД 0710096, ВерсФорм 5.04, НКО-профиль).
 *
 * Структура — зеркало XML из `buhotch.generator.ts`. Каждое поле, которое
 * попадает в XML, должно иметь своё представление здесь. Константы
 * (`КНД=0710096`, `Период=91`, `ОКЕИ=384`) в edits не храним — их проставляет
 * генератор. Всё, что пользователь может редактировать — редактируется.
 *
 * Суммы в тыс. рублей, integer, знаковые (отрицательные допустимы для пассивов
 * в некоторых случаях, XSD totalDigits=12). Минимальный range: -999999999999..+999999999999.
 */

enum SignerType {
  CHAIRMAN = 'chairman',
  REPRESENTATIVE = 'representative',
}

registerEnumType(SignerType, {
  name: 'BuhotchSignerType',
  description: 'Тип подписанта: руководитель или уполномоченный представитель',
});

// Integer в пределах 12 totalDigits — и для input, и для view.
const MAX_BALANCE_ABS = 999_999_999_999;

// ============================================================
// Общий Row (СумОтч / СумПрдщ / СумПрдшв)
// ============================================================

@InputType('BalanceRowEditsInput')
export class BalanceRowEditsInputDTO {
  @Field(() => Int)
  @IsInt()
  @Min(-MAX_BALANCE_ABS)
  @Max(MAX_BALANCE_ABS)
  otch!: number;

  @Field(() => Int)
  @IsInt()
  @Min(-MAX_BALANCE_ABS)
  @Max(MAX_BALANCE_ABS)
  prev!: number;

  @Field(() => Int)
  @IsInt()
  @Min(-MAX_BALANCE_ABS)
  @Max(MAX_BALANCE_ABS)
  prePrev!: number;
}

@ObjectType('BalanceRowEdits')
export class BalanceRowEditsDTO {
  @Field(() => Int)
  otch!: number;

  @Field(() => Int)
  prev!: number;

  @Field(() => Int)
  prePrev!: number;
}

// ============================================================
// Header — <Файл> + шапка <Документ>
// ============================================================

@InputType('BuhotchHeaderEditsInput')
export class BuhotchHeaderEditsInputDTO {
  /** `<Файл ИдФайл="...">` — имя файла без расширения. Обычно autogen. */
  @Field(() => String)
  @IsString()
  idFile!: string;

  /** `<Файл ВерсПрог="...">`. */
  @Field(() => String)
  @IsString()
  @Length(1, 40)
  programVersion!: string;

  /** `<Документ ДатаДок="DD.MM.YYYY">`. */
  @Field(() => String)
  @Matches(DATE_DDMMYYYY_PATTERN, { message: 'ДатаДок — DD.MM.YYYY' })
  docDate!: string;

  /** `<Документ ОтчетГод="...">`. */
  @Field(() => Int)
  @IsInt()
  @Min(2000)
  @Max(2100)
  reportYear!: number;

  /** `<Документ НомКорр="...">` — 0..999. */
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(999)
  correctionNumber!: number;

  /** `<Документ ПрАудит="0|1">`. */
  @Field(() => Boolean)
  @IsBoolean()
  audit!: boolean;

  /** `<Документ ПрУтвер="0|1">`. */
  @Field(() => Boolean)
  @IsBoolean()
  approved!: boolean;
}

@ObjectType('BuhotchHeaderEdits')
export class BuhotchHeaderEditsDTO {
  @Field(() => String) idFile!: string;
  @Field(() => String) programVersion!: string;
  @Field(() => String) docDate!: string;
  @Field(() => Int) reportYear!: number;
  @Field(() => Int) correctionNumber!: number;
  @Field(() => Boolean) audit!: boolean;
  @Field(() => Boolean) approved!: boolean;
}

// ============================================================
// Organization — <СвНП>/<НПЮЛ>
// ============================================================

@InputType('BuhotchOrganizationEditsInput')
export class BuhotchOrganizationEditsInputDTO {
  @Field(() => String)
  @IsString()
  @Length(1, 1000)
  orgName!: string;

  @Field(() => String)
  @Matches(INN_UL_PATTERN, { message: 'ИНН ЮЛ — 10 цифр' })
  inn!: string;

  @Field(() => String)
  @Matches(KPP_PATTERN, { message: 'КПП — 9 символов (4 цифры + 2 [0-9A-Z] + 3 цифры)' })
  kpp!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(OKPO_PATTERN, { message: 'ОКПО — 8 или 10 цифр' })
  okpo?: string | null;

  @Field(() => String)
  @Matches(OKFS_PATTERN, { message: 'ОКФС — 1-3 цифры' })
  okfs!: string;

  @Field(() => String)
  @Matches(OKOPF_PATTERN, { message: 'ОКОПФ — 5 цифр' })
  okopf!: string;
}

@ObjectType('BuhotchOrganizationEdits')
export class BuhotchOrganizationEditsDTO {
  @Field(() => String) orgName!: string;
  @Field(() => String) inn!: string;
  @Field(() => String) kpp!: string;
  @Field(() => String, { nullable: true }) address?: string | null;
  @Field(() => String, { nullable: true }) okpo?: string | null;
  @Field(() => String) okfs!: string;
  @Field(() => String) okopf!: string;
}

// ============================================================
// Signer — <Подписант>
// ============================================================

@InputType('BuhotchSignerEditsInput')
export class BuhotchSignerEditsInputDTO {
  @Field(() => SignerType)
  @IsEnum(SignerType)
  type!: SignerType;

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
  middleName?: string | null;

  /** `<СвПред НаимДок="...">` — только для type=representative. */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  repDoc?: string | null;
}

@ObjectType('BuhotchSignerEdits')
export class BuhotchSignerEditsDTO {
  @Field(() => SignerType) type!: SignerType;
  @Field(() => String) lastName!: string;
  @Field(() => String) firstName!: string;
  @Field(() => String, { nullable: true }) middleName?: string | null;
  @Field(() => String, { nullable: true }) repDoc?: string | null;
}

// ============================================================
// Balance — <Баланс ОКУД="0710001">
// ============================================================

/**
 * Актив по НКО-профилю: только 1170 (НеМатФинАкт), 1250 (ДенежнСр), 1240 (ФинВлож).
 * Итоги по Активу/Пассиву хранятся отдельно, т.к. XSD требует их явно и допускает
 * ±1 тыс. расхождение с суммой строк (регламент 0710001).
 */
@InputType('BuhotchBalanceEditsInput')
export class BuhotchBalanceEditsInputDTO {
  @Field(() => BalanceRowEditsInputDTO)
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  assetsTotal!: BalanceRowEditsInputDTO;

  @Field(() => BalanceRowEditsInputDTO, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  nonMaterialAndLongFin?: BalanceRowEditsInputDTO | null;

  @Field(() => BalanceRowEditsInputDTO, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  cash?: BalanceRowEditsInputDTO | null;

  @Field(() => BalanceRowEditsInputDTO, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  shortTermFin?: BalanceRowEditsInputDTO | null;

  @Field(() => BalanceRowEditsInputDTO)
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  passivesTotal!: BalanceRowEditsInputDTO;

  @Field(() => BalanceRowEditsInputDTO, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BalanceRowEditsInputDTO)
  targetFunds?: BalanceRowEditsInputDTO | null;
}

@ObjectType('BuhotchBalanceEdits')
export class BuhotchBalanceEditsDTO {
  @Field(() => BalanceRowEditsDTO) assetsTotal!: BalanceRowEditsDTO;
  @Field(() => BalanceRowEditsDTO, { nullable: true }) nonMaterialAndLongFin?: BalanceRowEditsDTO | null;
  @Field(() => BalanceRowEditsDTO, { nullable: true }) cash?: BalanceRowEditsDTO | null;
  @Field(() => BalanceRowEditsDTO, { nullable: true }) shortTermFin?: BalanceRowEditsDTO | null;
  @Field(() => BalanceRowEditsDTO) passivesTotal!: BalanceRowEditsDTO;
  @Field(() => BalanceRowEditsDTO, { nullable: true }) targetFunds?: BalanceRowEditsDTO | null;
}

// ============================================================
// Notes — <Пояснения>
// ============================================================

@InputType('BuhotchNotesEditsInput')
export class BuhotchNotesEditsInputDTO {
  /** `<Пояснения НаимФайлПЗ="...">` — обязательное, minLength=1. */
  @Field(() => String)
  @IsString()
  @Length(1, 255)
  explanationFileName!: string;
}

@ObjectType('BuhotchNotesEdits')
export class BuhotchNotesEditsDTO {
  @Field(() => String) explanationFileName!: string;
}

// ============================================================
// Root
// ============================================================

@InputType('BuhotchEditsInput')
export class BuhotchEditsInputDTO {
  @Field(() => BuhotchHeaderEditsInputDTO)
  @ValidateNested()
  @Type(() => BuhotchHeaderEditsInputDTO)
  header!: BuhotchHeaderEditsInputDTO;

  @Field(() => BuhotchOrganizationEditsInputDTO)
  @ValidateNested()
  @Type(() => BuhotchOrganizationEditsInputDTO)
  organization!: BuhotchOrganizationEditsInputDTO;

  @Field(() => BuhotchSignerEditsInputDTO)
  @ValidateNested()
  @Type(() => BuhotchSignerEditsInputDTO)
  signer!: BuhotchSignerEditsInputDTO;

  @Field(() => BuhotchBalanceEditsInputDTO)
  @ValidateNested()
  @Type(() => BuhotchBalanceEditsInputDTO)
  balance!: BuhotchBalanceEditsInputDTO;

  @Field(() => BuhotchNotesEditsInputDTO)
  @ValidateNested()
  @Type(() => BuhotchNotesEditsInputDTO)
  notes!: BuhotchNotesEditsInputDTO;
}

@ObjectType('BuhotchEdits')
export class BuhotchEditsDTO {
  @Field(() => BuhotchHeaderEditsDTO) header!: BuhotchHeaderEditsDTO;
  @Field(() => BuhotchOrganizationEditsDTO) organization!: BuhotchOrganizationEditsDTO;
  @Field(() => BuhotchSignerEditsDTO) signer!: BuhotchSignerEditsDTO;
  @Field(() => BuhotchBalanceEditsDTO) balance!: BuhotchBalanceEditsDTO;
  @Field(() => BuhotchNotesEditsDTO) notes!: BuhotchNotesEditsDTO;
}

export { SignerType as BuhotchSignerType };
