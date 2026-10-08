import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';
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
}
