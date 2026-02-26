import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ProjectPropertyStatus } from '../../../domain/enums/project-property-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности ProjectProperty
 */
@ObjectType('CapitalProjectProperty', {
  description: 'Проектный имущественный взнос в системе CAPITAL',
})
export class ProjectPropertyOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => ProjectPropertyStatus, {
    description: 'Статус проектного имущественного взноса',
  })
  status!: ProjectPropertyStatus;

  @Field(() => String, {
    description: 'Хеш имущественного взноса',
  })
  property_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта',
  })
  project_hash?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Количество имущества',
  })
  property_amount?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Описание имущества',
  })
  property_description?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;
}
