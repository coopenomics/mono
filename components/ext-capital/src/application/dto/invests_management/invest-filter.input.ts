import { InputType, Field } from '@nestjs/graphql';
import { InvestStatus } from '../../../domain/enums/invest-status.enum';

/**
 * Input DTO для фильтрации инвестиций
 */
@InputType('CapitalInvestFilter', {
  description: 'Параметры фильтрации для запросов инвестиций CAPITAL',
})
export class InvestFilterInputDTO {
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

  @Field(() => InvestStatus, {
    nullable: true,
    description: 'Фильтр по статусу инвестиции',
  })
  status?: InvestStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу инвестиции',
  })
  invest_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по координатору',
  })
  coordinator?: string;
}
