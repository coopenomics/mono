import { InputType, Field } from '@nestjs/graphql';
import { CommitStatus } from '../../../domain/enums/commit-status.enum';

/**
 * Input DTO для фильтрации коммитов
 */
@InputType('CapitalCommitFilter', {
  description: 'Параметры фильтрации для запросов коммитов CAPITAL',
})
export class CommitFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу коммита',
  })
  commit_hash?: string;

  @Field(() => CommitStatus, {
    nullable: true,
    description: 'Фильтр по статусу коммита',
  })
  status?: CommitStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по имени пользователя',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по статусу из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по дате создания (YYYY-MM-DD)',
  })
  created_date?: string;
}
