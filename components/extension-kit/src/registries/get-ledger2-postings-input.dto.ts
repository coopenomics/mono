import { Field, Int, InputType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Input для `getLedger2Postings` — реестр проводок (debit+credit парами).
 * Все фильтры серверные.
 */
@InputType('GetLedger2PostingsInput')
export class GetLedger2PostingsInputDTO {
  @Field(() => String)
  @IsString()
  coopname!: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Бух.счёт (×1000) — попадание в debit ИЛИ credit ноге проводки.',
  })
  @IsOptional()
  @IsInt()
  accountId?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @Field(() => String, { nullable: true, description: 'process_hash для выборки всех проводок одной операции' })
  @IsOptional()
  @IsString()
  @MaxLength(66)
  processHash?: string;

  @Field(() => String, {
    nullable: true,
    description: '№ проводки = debit.global_sequence (unique). Парный credit подтянется автоматически.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  debitGlobalSequence?: string;

  @Field(() => String, {
    nullable: true,
    description: '№ операции = apply.global_sequence. Возвращает проводки ровно этой apply-группы.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  applyGlobalSequence?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateFrom?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateTo?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @Field(() => String, { nullable: true, defaultValue: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
