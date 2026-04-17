import { ObjectType, Field, InputType, Int, Float, registerEnumType } from '@nestjs/graphql';
import { IsString, IsInt, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, IsIn } from 'class-validator';
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
  year!: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  period?: number;

  @Field(() => Int, { nullable: true, description: 'Номер корректировки декларации (0 — первичная)' })
  @IsOptional()
  @IsInt()
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

@InputType('OrganizationDataInput')
export class OrganizationDataInputDTO {
  @Field(() => String)
  @IsString()
  inn!: string;

  @Field(() => String)
  @IsString()
  kpp!: string;

  @Field(() => String)
  @IsString()
  orgName!: string;

  @Field(() => String)
  @IsString()
  ogrn!: string;

  @Field(() => String)
  @IsString()
  okved!: string;

  @Field(() => String)
  @IsString()
  oktmo!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  okfs?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  okopf?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field(() => String, { nullable: true, description: 'ОКПО' })
  @IsOptional()
  @IsString()
  okpo?: string;

  @Field(() => String)
  @IsString()
  signerLastName!: string;

  @Field(() => String)
  @IsString()
  signerFirstName!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
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
  signerRepDoc?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  signerSnils?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Регистрационный номер страхователя в СФР (для ЕФС-1)',
  })
  @IsOptional()
  @IsString()
  sfrRegNumber?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Должность руководителя, указывается в ЕФС-1 (по умолчанию «Председатель Совета»)',
  })
  @IsOptional()
  @IsString()
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
  year?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  period?: number;

  @Field(() => Int, { nullable: true, description: 'Лимит (макс 100, по умолчанию 20)' })
  @IsOptional()
  @IsInt()
  limit?: number;

  @Field(() => Int, { nullable: true, description: 'Сдвиг для пагинации (по умолчанию 0)' })
  @IsOptional()
  @IsInt()
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
