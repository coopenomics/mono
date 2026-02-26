import { ObjectType, Field, Int } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { CommitStatus } from '../../../domain/enums/commit-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { BaseProjectOutputDTO } from '../project_management/project.dto';

/**
 * GraphQL Output DTO для данных amounts коммита
 */
@ObjectType('CapitalCommitAmounts', {
  description: 'Данные amounts коммита',
})
export class CommitAmountsOutputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Стоимость часа работы',
  })
  hour_cost?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Часы создателей',
  })
  creators_hours?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Базовый пул создателей',
  })
  creators_base_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Базовый пул авторов',
  })
  authors_base_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Бонусный пул создателей',
  })
  creators_bonus_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Бонусный пул авторов',
  })
  authors_bonus_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Общий генерационный пул',
  })
  total_generation_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Бонусный пул участников',
  })
  contributors_bonus_pool?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Общий объем вклада',
  })
  total_contribution?: string;
}

/**
 * GraphQL Output DTO для сущности Commit
 */
@ObjectType('CapitalCommit', {
  description: 'Коммит в системе CAPITAL',
})
export class CommitOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => CommitStatus, {
    description: 'Статус коммита',
  })
  status!: CommitStatus;

  @Field(() => String, {
    description: 'Хеш коммита',
  })
  commit_hash!: string;

  @Field(() => String, {
    description: 'Описание коммита',
  })
  description!: string;

  @Field(() => String, {
    description: 'Метаданные коммита',
  })
  meta!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Обогащенные данные коммита (diff-патч, исходная ссылка и т.д.)',
  })
  data?: any;

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
    description: 'Отображаемое имя пользователя',
  })
  display_name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;

  @Field(() => BaseProjectOutputDTO, {
    nullable: true,
    description: 'Проект, к которому относится коммит',
  })
  project?: BaseProjectOutputDTO;

  @Field(() => CommitAmountsOutputDTO, {
    nullable: true,
    description: 'Данные amounts коммита',
  })
  amounts?: CommitAmountsOutputDTO;
}
