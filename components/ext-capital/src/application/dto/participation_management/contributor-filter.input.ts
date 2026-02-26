import { InputType, Field } from '@nestjs/graphql';
import { ContributorStatus } from '../../../domain/enums/contributor-status.enum';

/**
 * Input DTO для фильтрации участников
 */
@InputType('CapitalContributorFilter', {
  description: 'Параметры фильтрации для запросов участников CAPITAL',
})
export class ContributorFilterInputDTO {
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

  @Field(() => ContributorStatus, {
    nullable: true,
    description: 'Фильтр по статусу участника',
  })
  status?: ContributorStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу участника',
  })
  contributor_hash?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по наличию внешнего контракта',
  })
  is_external_contract?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Поиск по ФИО или названию организации (частичное совпадение)',
  })
  display_name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по project_hash - показывает только участников, у которых в appendixes есть указанный project_hash',
  })
  project_hash?: string;
}
