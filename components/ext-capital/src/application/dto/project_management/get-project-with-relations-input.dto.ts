import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения проекта с отношениями по хешу проекта
 */
@InputType('GetProjectWithRelationsInput')
export class GetProjectWithRelationsInputDTO {
  @Field(() => String, { description: 'Хеш проекта' })
  @IsString()
  projectHash!: string;
}
