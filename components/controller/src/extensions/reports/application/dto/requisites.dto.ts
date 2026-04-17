import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
import { ReportType } from '../../domain/enums/report-type.enum';

export enum RequisiteSource {
  BLOCKCHAIN = 'blockchain',
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

  // Поля из блокчейна.
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

  // Ручные поля из БД.
  @Field(() => RequisiteFieldViewDTO) okved!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okfs!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okopf!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) oktmo!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) okpo!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) sfrRegNumber!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) chairmanPosition!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerSnils!: RequisiteFieldViewDTO;
  @Field(() => RequisiteFieldViewDTO) signerRepDoc!: RequisiteFieldViewDTO;
}

@InputType('UpdateReportRequisitesInput')
export class UpdateReportRequisitesInputDTO {
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() okved?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() okfs?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() okopf?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() oktmo?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() okpo?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() sfrRegNumber?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() chairmanPosition?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() signerSnils?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() signerRepDoc?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() phoneOverride?: string | null;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() addressOverride?: string | null;
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
