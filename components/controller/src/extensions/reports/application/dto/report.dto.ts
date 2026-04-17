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
}

@ObjectType('GeneratedReport')
export class GeneratedReportDTO {
  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => String)
  xml!: string;

  @Field(() => String)
  fileName!: string;

  @Field(() => [String])
  errors!: string[];

  @Field(() => Boolean)
  isValid!: boolean;
}
