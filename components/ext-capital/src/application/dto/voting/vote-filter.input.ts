import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO для фильтрации голосов
 */
@InputType('VoteFilter')
export class VoteFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по имени пользователя' })
  @IsOptional()
  @IsString()
  voter?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по получателю' })
  @IsOptional()
  @IsString()
  recipient?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по хешу проекта' })
  @IsOptional()
  @IsString()
  project_hash?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по кооперативу' })
  @IsOptional()
  @IsString()
  coopname?: string;
}
