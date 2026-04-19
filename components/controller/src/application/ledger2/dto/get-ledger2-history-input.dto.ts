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

  @Field(() => Int, { nullable: true, description: 'ID счёта/кошелька (×1000)' })
  @IsOptional()
  @IsInt()
  accountId?: number;

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
    description: 'ACTION_REGISTRY коды: cap.debt, wall.deposit, mig.opening и т.д.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionCodes?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

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
