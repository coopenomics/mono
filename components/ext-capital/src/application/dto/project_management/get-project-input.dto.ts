import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';

/**
 * DTO для получения проекта
 */
@InputType('GetProjectInput')
export class GetProjectInputDTO {
  @Field(() => String, { description: 'Хеш проекта' })
  @IsString()
  hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш родительского проекта для фильтрации компонентов',
  })
  @IsOptional()
  @IsString()
  parent_hash?: string;
}
