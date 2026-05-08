import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportType } from '../../domain/enums/report-type.enum';
import { ReportSubmissionMark } from '../../domain/enums/report-submission-mark.enum';

export enum CalendarEntryStatus {
  EMPTY = 'empty',
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  SUBMITTED_EXTERNALLY = 'submitted_externally',
  OVERDUE = 'overdue',
  NOT_REQUIRED = 'not_required',
  BEFORE_REGISTRATION = 'before_registration',
}

registerEnumType(CalendarEntryStatus, {
  name: 'CalendarEntryStatus',
  description:
    'Статус ячейки календаря: empty, draft, submitted (реальный XML в архиве), ' +
    'submitted_externally (отметка «сдано сторонне»), overdue, not_required, ' +
    'before_registration (период приходился на даты до регистрации кооператива — сдавать не надо). ' +
    'Приоритет: submitted > submitted_externally > draft > not_required > before_registration > overdue > empty.',
});

registerEnumType(ReportSubmissionMark, {
  name: 'ReportSubmissionMark',
  description:
    'Пользовательская отметка на ячейке календаря: NOT_REQUIRED («не надо сдавать») ' +
    'или SUBMITTED_EXTERNALLY («сдано вне платформы»).',
});

@InputType('MarkReportPeriodInput')
export class MarkReportPeriodInputDTO {
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

  /** null — снять отметку; непустое значение — поставить. */
  @Field(() => ReportSubmissionMark, { nullable: true })
  @IsOptional()
  @IsEnum(ReportSubmissionMark)
  mark?: ReportSubmissionMark | null;
}

@ObjectType('ReportCalendarPeriodEntry')
export class ReportCalendarPeriodEntryDTO {
  /** 1..4 для quarterly, 1..12 для monthly, null для yearly. */
  @Field(() => Int, { nullable: true })
  periodCode!: number | null;

  /**
   * Год, ЗА который отчитывается эта ячейка. В общем случае не совпадает
   * с отображаемым годом календаря: для yearly БУХОТЧ и Q4/декабрьских
   * ячеек (dueYearOffset=1) reportYear = displayYear - 1.
   * Именно это значение нужно слать в форму редактора.
   */
  @Field(() => Int)
  reportYear!: number;

  /** Человекочитаемая метка: «I кв.», «Январь», «Год». */
  @Field(() => String)
  label!: string;

  /** Месяц сдачи в календаре UI (1..12). */
  @Field(() => Int)
  dueMonth!: number;

  /** ISO-дата сдачи (YYYY-MM-DD). */
  @Field(() => String)
  dueDate!: string;

  @Field(() => CalendarEntryStatus)
  status!: CalendarEntryStatus;
}

@ObjectType('ReportCalendarRow')
export class ReportCalendarRowDTO {
  @Field(() => ReportType)
  reportType!: ReportType;

  @Field(() => String)
  shortName!: string;

  /** 'yearly' | 'quarterly' | 'monthly'. */
  @Field(() => String)
  periodKind!: string;

  @Field(() => [ReportCalendarPeriodEntryDTO])
  periods!: ReportCalendarPeriodEntryDTO[];
}
