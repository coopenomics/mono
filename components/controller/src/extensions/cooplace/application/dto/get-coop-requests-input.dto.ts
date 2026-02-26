import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { RequestTypeInput } from './create-request-input.dto';

/**
 * Input для получения заявок кооператива
 */
@InputType()
export class GetCoopRequestsInput {
  @Field({ description: 'Название кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => RequestTypeInput, { description: 'Тип заявки', nullable: true })
  @IsOptional()
  @IsEnum(RequestTypeInput)
  type?: RequestTypeInput;

  @Field({ description: 'Статус заявки', nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
