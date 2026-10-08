import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

@InputType('DebtLoanFilterInput')
export class LoanFilterInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-заёмщик' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => LoanStatus, { nullable: true, description: 'Состояние займа' })
  @IsOptional()
  status?: LoanStatus;

  @Field(() => String, { nullable: true, description: 'Контракт-источник записи' })
  @IsOptional()
  @IsString()
  source?: string;

  @Field(() => Boolean, { nullable: true, description: 'Только выданные и не закрытые займы: в срок и в просрочке' })
  @IsOptional()
  @IsBoolean()
  outstanding?: boolean;

  @Field(() => Int, { nullable: true, description: 'Выданные займы, срок которых наступает в ближайшие столько дней' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  due_within_days?: number;
}
