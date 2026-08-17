import { Field, InputType, Int, Float } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
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
  ZeroReportHeaderEditsInputDTO,
  ZeroReportOrganizationEditsInputDTO,
  ZeroReportSignerEditsInputDTO,
} from './zero-report-edits.dto';
import { DATE_DDMMYYYY_PATTERN } from '../../domain/patterns';

/**
 * DTO 6-НДФЛ — зеркало `Ndfl6EditsShape`. Шапка, реквизиты и подписант общие
 * с остальными формами, а разделы с суммами и справки о доходах есть только
 * здесь: кооператив удерживает налог только с материальной помощи.
 *
 * Суммы приходят посчитанными из ledger2, но остаются редактируемыми —
 * бухгалтер вправе поправить расчёт, если выплата прошла мимо платформы.
 */

@InputType('Ndfl6TaxEditsInput')
export class Ndfl6TaxEditsInputDTO {
  @Field(() => Int, { description: 'Количество физлиц, получивших доход с начала года' })
  @IsInt()
  @Min(0)
  peopleCount!: number;

  @Field(() => Float, { description: 'Сумма дохода до удержания налога, с начала года' })
  @IsNumber()
  @Min(0)
  incomeTotal!: number;

  @Field(() => Float, { description: 'Сумма налоговых вычетов с начала года' })
  @IsNumber()
  @Min(0)
  deductionsTotal!: number;

  @Field(() => Float, { description: 'Налоговая база с начала года' })
  @IsNumber()
  @Min(0)
  taxBase!: number;

  @Field(() => Int, { description: 'Сумма налога исчисленная с начала года, рублей' })
  @IsInt()
  @Min(0)
  taxCalculated!: number;

  @Field(() => Int, { description: 'Сумма налога удержанная с начала года, рублей' })
  @IsInt()
  @Min(0)
  withheldTotal!: number;

  @Field(() => [Int], {
    description:
      'Налог по шести срокам перечисления последнего квартала: ' +
      '1–22 и 23–конец каждого из трёх месяцев',
  })
  @IsArray()
  @ArrayMinSize(6)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(0, { each: true })
  byTerm!: number[];
}

@InputType('Ndfl6MonthlyIncomeEditsInput')
export class Ndfl6MonthlyIncomeEditsInputDTO {
  @Field(() => Int, { description: 'Порядковый номер месяца, 1–12' })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Field(() => String, { description: 'Код вида дохода, 4 знака' })
  @IsString()
  @Length(4, 4)
  incomeCode!: string;

  @Field(() => Float, { description: 'Сумма дохода за месяц' })
  @IsNumber()
  @Min(0)
  amount!: number;
}

@InputType('Ndfl6CertificateEditsInput')
export class Ndfl6CertificateEditsInputDTO {
  @Field(() => String, { description: 'Имя аккаунта получателя дохода' })
  @IsString()
  username!: string;

  @Field(() => Int, { description: 'Порядковый номер справки' })
  @IsInt()
  @Min(1)
  number!: number;

  @Field(() => String, {
    description: 'Номер корректировки справки: «00» первичная, «99» аннулирующая',
  })
  @Matches(/^\d{2}$/, { message: 'Номер корректировки справки — ровно две цифры' })
  correctionNumber!: string;

  @Field(() => String, { description: 'Фамилия получателя' })
  @IsString()
  @Length(1, 60)
  lastName!: string;

  @Field(() => String, { description: 'Имя получателя' })
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @Field(() => String, { nullable: true, description: 'Отчество получателя' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  middleName!: string | null;

  @Field(() => String, { description: 'Дата рождения, ДД.ММ.ГГГГ' })
  @Matches(DATE_DDMMYYYY_PATTERN, { message: 'Дата рождения — ДД.ММ.ГГГГ' })
  birthDate!: string;

  @Field(() => String, { description: 'Код статуса налогоплательщика: 1 — резидент РФ' })
  @Matches(/^\d$/, { message: 'Статус налогоплательщика — одна цифра' })
  taxpayerStatus!: string;

  @Field(() => String, { description: 'Гражданство, код страны по ОКСМ: 643 — Россия' })
  @Matches(/^\d{3}$/, { message: 'Код страны — три цифры' })
  citizenshipCode!: string;

  @Field(() => String, {
    description: 'Код вида документа, удостоверяющего личность: 21 — паспорт РФ',
  })
  @Matches(/^\d{2}$/, { message: 'Код вида документа — две цифры' })
  documentTypeCode!: string;

  @Field(() => String, { description: 'Серия и номер документа' })
  @IsString()
  @Length(1, 25)
  documentSerialNumber!: string;

  @Field(() => Float, { description: 'Общая сумма дохода за год' })
  @IsNumber()
  @Min(0)
  incomeTotal!: number;

  @Field(() => Float, { description: 'Налоговая база за год' })
  @IsNumber()
  @Min(0)
  taxBase!: number;

  @Field(() => Int, { description: 'Налог исчисленный за год, рублей' })
  @IsInt()
  @Min(0)
  taxCalculated!: number;

  @Field(() => Int, { description: 'Налог удержанный за год, рублей' })
  @IsInt()
  @Min(0)
  taxWithheld!: number;

  @Field(() => [Ndfl6MonthlyIncomeEditsInputDTO], { description: 'Доход по месяцам' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Ndfl6MonthlyIncomeEditsInputDTO)
  monthlyIncome!: Ndfl6MonthlyIncomeEditsInputDTO[];
}

@InputType('Ndfl6EditsInput')
export class Ndfl6EditsInputDTO {
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

  @Field(() => Ndfl6TaxEditsInputDTO)
  @ValidateNested()
  @Type(() => Ndfl6TaxEditsInputDTO)
  tax!: Ndfl6TaxEditsInputDTO;

  @Field(() => [Ndfl6CertificateEditsInputDTO], {
    description: 'Справки о доходах — только в годовом отчёте',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Ndfl6CertificateEditsInputDTO)
  certificates!: Ndfl6CertificateEditsInputDTO[];
}
