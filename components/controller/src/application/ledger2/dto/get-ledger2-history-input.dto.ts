import { Field, Int, InputType } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Input для `getLedger2History`. Все фильтры серверные — клиент не
 * фильтрует в памяти, иначе при пагинации выпадают значения.
 */
@InputType('GetLedger2HistoryInput')
export class GetLedger2HistoryInputDTO {
  @Field(() => String)
  @IsString()
  coopname!: string;

  @Field(() => Int, { nullable: true, description: 'Бух.счёт (×1000): 51000/80000/86000 — для debit/credit действий.' })
  @IsOptional()
  @IsInt()
  accountId?: number;

  @Field(() => String, {
    nullable: true,
    description: 'eosio::name кошелька (`w.<contract>.<waltype>`) — для walletop действий.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(13)
  walletName?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Имена blockchain-действий: apply | walletop | debit | credit',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionNames?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'OPERATION_REGISTRY коды: o.cap.lend, o.wal.depcpl, o.mig.minshr и т.д.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationCodes?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @Field(() => String, { nullable: true, description: 'process_hash для выборки всех действий одной операции' })
  @IsOptional()
  @IsString()
  @MaxLength(66)
  processHash?: string;

  @Field(() => String, {
    nullable: true,
    description:
      'global_sequence родительского apply: фильтрует siblings (walletop/debit/credit) диапазоном до следующего apply того же processHash',
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  parentApplyGlobalSequence?: string;

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
