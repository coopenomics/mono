import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

/**
 * Input для поиска заявок
 */
@InputType()
export class SearchRequestsInput {
  @Field({ description: 'Текст для поиска по названию товара' })
  @IsString()
  searchTerm!: string;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
