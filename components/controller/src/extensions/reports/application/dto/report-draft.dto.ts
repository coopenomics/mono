import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ReportType } from '../../domain/enums/report-type.enum';

/**
 * Edits-состояние формы хранится как JSON-строка — структура per-type
 * (BuhotchEdits, Ndfl6Edits, …) задаётся отдельными DTO. Здесь — контейнер.
 */
@InputType('SaveReportDraftInput')
export class SaveReportDraftInputDTO {
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
  @Min(0)
  @Max(12)
  period?: number | null;

  /** Сериализованное состояние формы (JSON-строка). */
  @Field(() => String)
  @IsString()
  editsJson!: string;

  /** JSONPath-пути полей, которые пользователь трогал руками. */
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  editedFields!: string[];
}

@InputType('ListReportDraftsFilterInput')
export class ListReportDraftsFilterInputDTO {
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
  period?: number | null;
}

/**
 * Возврат `buildInitialReportEdits`: предзаполненное состояние формы +
 * список полей, которые пользователь уже трогал (если draft существовал).
 * `editsJson` — уже с наложенными dirty-полями.
 */
@ObjectType('BuildInitialReportEdits')
export class BuildInitialReportEditsDTO {
  @Field(() => String)
  editsJson!: string;

  @Field(() => [String])
  editedFields!: string[];

  /** True если уже существовал сохранённый draft (и dirty-поля применены). */
  @Field(() => Boolean)
  hasDraft!: boolean;
}

@ObjectType('ReportDraft')
export class ReportDraftDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  ownerUsername!: string;

  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => Int)
  year!: number;

  @Field(() => Int, { nullable: true })
  period?: number | null;

  /** Сериализованное состояние формы. */
  @Field(() => String)
  editsJson!: string;

  @Field(() => [String])
  editedFields!: string[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
