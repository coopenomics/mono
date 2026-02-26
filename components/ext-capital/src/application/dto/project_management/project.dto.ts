import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { ProjectPermissionsOutputDTO } from './project-permissions.dto';

/**
 * GraphQL Output DTO для счетчиков участников проекта
 */
@ObjectType('CapitalProjectCountsData', {
  description: 'Счетчики участников проекта',
})
export class CapitalProjectCountsDataOutputDTO {
  @Field(() => Int, {
    description: 'Общее количество уникальных участников',
  })
  total_unique_participants!: number;

  @Field(() => Int, {
    description: 'Общее количество авторов',
  })
  total_authors!: number;

  @Field(() => Int, {
    description: 'Общее количество координаторов',
  })
  total_coordinators!: number;

  @Field(() => Int, {
    description: 'Общее количество создателей',
  })
  total_creators!: number;

  @Field(() => Int, {
    description: 'Общее количество инвесторов',
  })
  total_investors!: number;

  @Field(() => Int, {
    description: 'Общее количество проперторов',
  })
  total_propertors!: number;

  @Field(() => Int, {
    description: 'Общее количество участников',
  })
  total_contributors!: number;

  @Field(() => Int, {
    description: 'Общее количество коммитов',
  })
  total_commits!: number;
}

/**
 * GraphQL Output DTO для плановых показателей проекта
 */
@ObjectType('CapitalProjectPlanPool', {
  description: 'Плановые показатели проекта',
})
export class CapitalProjectPlanPoolOutputDTO {
  @Field(() => String, {
    description: 'Плановая стоимость часа работы',
  })
  hour_cost!: string;

  @Field(() => Int, {
    description: 'Плановые часы создателей',
  })
  creators_hours!: number;

  @Field(() => Float, {
    description: 'Процент возврата базового пула',
  })
  return_base_percent!: number;

  @Field(() => Float, {
    description: 'Процент использования инвестиций',
  })
  use_invest_percent!: number;

  @Field(() => String, {
    description: 'Базовый пул создателей',
  })
  creators_base_pool!: string;

  @Field(() => String, {
    description: 'Базовый пул авторов',
  })
  authors_base_pool!: string;

  @Field(() => String, {
    description: 'Базовый пул координаторов',
  })
  coordinators_base_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул создателей',
  })
  creators_bonus_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул авторов',
  })
  authors_bonus_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул участников',
  })
  contributors_bonus_pool!: string;

  @Field(() => String, {
    description: 'Целевой пул расходов',
  })
  target_expense_pool!: string;

  @Field(() => String, {
    description: 'Инвестиционный пул',
  })
  invest_pool!: string;

  @Field(() => String, {
    description: 'Инвестиционный пул координаторов',
  })
  coordinators_investment_pool!: string;

  @Field(() => String, {
    description: 'Программный инвестиционный пул',
  })
  program_invest_pool!: string;

  @Field(() => String, {
    description: 'Общий объем полученных инвестиций',
  })
  total_received_investments!: string;

  @Field(() => String, {
    description: 'Общий генерационный пул',
  })
  total_generation_pool!: string;

  @Field(() => String, {
    description: 'Общая сумма',
  })
  total!: string;

  @Field(() => String, {
    description: 'Общая сумма',
  })
  total_with_investments!: string;
}

/**
 * GraphQL Output DTO для фактических показателей проекта
 */
@ObjectType('CapitalProjectFactPool', {
  description: 'Фактические показатели проекта',
})
export class CapitalProjectFactPoolOutputDTO {
  @Field(() => String, {
    description: 'Стоимость часа работы',
  })
  hour_cost!: string;

  @Field(() => Int, {
    description: 'Часы создателей',
  })
  creators_hours!: number;

  @Field(() => Float, {
    description: 'Процент возврата базового пула',
  })
  return_base_percent!: number;

  @Field(() => Float, {
    description: 'Процент использования инвестиций',
  })
  use_invest_percent!: number;

  @Field(() => String, {
    description: 'Базовый пул создателей',
  })
  creators_base_pool!: string;

  @Field(() => String, {
    description: 'Базовый пул авторов',
  })
  authors_base_pool!: string;

  @Field(() => String, {
    description: 'Базовый пул координаторов',
  })
  coordinators_base_pool!: string;

  @Field(() => String, {
    description: 'Имущественный базовый пул',
  })
  property_base_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул создателей',
  })
  creators_bonus_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул авторов',
  })
  authors_bonus_pool!: string;

  @Field(() => String, {
    description: 'Бонусный пул участников',
  })
  contributors_bonus_pool!: string;

  @Field(() => String, {
    description: 'Целевой пул расходов',
  })
  target_expense_pool!: string;

  @Field(() => String, {
    description: 'Накопленный пул расходов',
  })
  accumulated_expense_pool!: string;

  @Field(() => String, {
    description: 'Использованный пул расходов',
  })
  used_expense_pool!: string;

  @Field(() => String, {
    description: 'Инвестиционный пул',
  })
  invest_pool!: string;

  @Field(() => String, {
    description: 'Инвестиционный пул координаторов',
  })
  coordinators_investment_pool!: string;

  @Field(() => String, {
    description: 'Программный инвестиционный пул',
  })
  program_invest_pool!: string;

  @Field(() => String, {
    description: 'Общий объем полученных инвестиций',
  })
  total_received_investments!: string;

  @Field(() => String, {
    description: 'Общий объем использованных инвестиций',
  })
  total_used_investments!: string;

  @Field(() => String, {
    description: 'Общий объем возвращенных инвестиций',
  })
  total_returned_investments!: string;

  @Field(() => String, {
    description: 'Общий генерационный пул',
  })
  total_generation_pool!: string;

  @Field(() => String, {
    description: 'Общий объем взноса старших участников',
  })
  total_contribution!: string;

  @Field(() => String, {
    description: 'Общая сумма',
  })
  total!: string;

  @Field(() => String, {
    description: 'Общий объем взноса старших участников',
  })
  total_with_investments!: string;
}

/**
 * GraphQL Output DTO для данных CRPS распределения наград
 */
@ObjectType('CapitalProjectCrpsData', {
  description: 'Данные CRPS для распределения наград проекта',
})
export class CapitalProjectCrpsDataOutputDTO {
  @Field(() => String, {
    description: 'Общее количество долей участников капитала',
  })
  total_capital_contributors_shares!: string;

  @Field(() => Float, {
    description: 'Накопительный коэффициент вознаграждения за базовый вклад авторов',
  })
  author_base_cumulative_reward_per_share!: number;

  @Field(() => Float, {
    description: 'Накопительный коэффициент вознаграждения за бонусный вклад авторов',
  })
  author_bonus_cumulative_reward_per_share!: number;

  @Field(() => Float, {
    description: 'Накопительный коэффициент вознаграждения участников',
  })
  contributor_cumulative_reward_per_share!: number;
}

/**
 * GraphQL Output DTO для сумм голосования
 */
@ObjectType('CapitalProjectVotingAmounts', {
  description: 'Суммы голосования проекта',
})
export class CapitalProjectVotingAmountsOutputDTO {
  @Field(() => String, {
    description: 'Равномерное распределение среди авторов',
  })
  authors_equal_spread!: string;

  @Field(() => String, {
    description: 'Прямое распределение среди создателей',
  })
  creators_direct_spread!: string;

  @Field(() => String, {
    description: 'Бонусы авторов при голосовании',
  })
  authors_bonuses_on_voting!: string;

  @Field(() => String, {
    description: 'Бонусы создателей при голосовании',
  })
  creators_bonuses_on_voting!: string;

  @Field(() => String, {
    description: 'Общий пул голосования',
  })
  total_voting_pool!: string;

  @Field(() => String, {
    description: 'Активная сумма голосования',
  })
  active_voting_amount!: string;

  @Field(() => String, {
    description: 'Равная сумма голосования',
  })
  equal_voting_amount!: string;

  @Field(() => String, {
    description: 'Равная сумма на автора',
  })
  authors_equal_per_author!: string;
}

/**
 * GraphQL Output DTO для данных голосования по методу Водянова
 */
@ObjectType('CapitalProjectVotingData', {
  description: 'Данные голосования по методу Водянова',
})
export class CapitalProjectVotingDataOutputDTO {
  @Field(() => Int, {
    description: 'Общее количество участников голосования',
  })
  total_voters!: number;

  @Field(() => Int, {
    description: 'Количество полученных голосов',
  })
  votes_received!: number;

  @Field(() => Float, {
    description: 'Процент голосования авторов',
  })
  authors_voting_percent!: number;

  @Field(() => Float, {
    description: 'Процент голосования создателей',
  })
  creators_voting_percent!: number;

  @Field(() => String, {
    description: 'Дата окончания голосования',
  })
  voting_deadline!: string;

  @Field(() => CapitalProjectVotingAmountsOutputDTO, {
    description: 'Суммы голосования',
  })
  amounts!: CapitalProjectVotingAmountsOutputDTO;
}

/**
 * GraphQL Output DTO для данных CRPS членских взносов
 */
@ObjectType('CapitalProjectMembershipCrps', {
  description: 'Данные CRPS для распределения членских взносов проекта',
})
export class CapitalProjectMembershipCrpsOutputDTO {
  @Field(() => Float, {
    description: 'Накопительный коэффициент вознаграждения на акцию',
  })
  cumulative_reward_per_share!: number;

  @Field(() => String, {
    description: 'Общее количество акций',
  })
  total_shares!: string;

  @Field(() => String, {
    description: 'Профинансированная сумма',
  })
  funded!: string;

  @Field(() => String, {
    description: 'Доступная сумма',
  })
  available!: string;

  @Field(() => String, {
    description: 'Распределенная сумма',
  })
  distributed!: string;

  @Field(() => String, {
    description: 'Сконвертированные средства',
  })
  converted_funds!: string;
}

/**
 * Базовый GraphQL Output DTO для сущности Project
 * Не содержит рекурсивных полей для избежания циклических зависимостей
 */
@ObjectType('BaseCapitalProject', {
  description: 'Базовый проект в системе CAPITAL',
})
export class BaseProjectOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    description: 'ID в блокчейне',
  })
  id!: number;

  @Field(() => String, {
    description: 'Префикс проекта',
  })
  prefix!: string;

  @Field(() => Int, {
    description: 'Счетчик задач проекта',
  })
  issue_counter!: number;

  @Field(() => ProjectStatus, {
    description: 'Статус проекта',
  })
  status!: ProjectStatus;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Хеш родительского проекта',
  })
  parent_hash!: string;

  @Field(() => String, {
    description: 'Название родительского проекта',
    nullable: true,
  })
  parent_title?: string;

  @Field(() => String, {
    description: 'Статус из блокчейна',
  })
  blockchain_status!: string;

  @Field(() => Boolean, {
    description: 'Открыт ли проект',
  })
  is_opened!: boolean;

  @Field(() => Boolean, {
    description: 'Запланирован ли проект',
  })
  is_planed!: boolean;

  @Field(() => String, {
    description: 'Мастер проекта',
  })
  master!: string;

  @Field(() => String, {
    description: 'Название проекта',
  })
  title!: string;

  @Field(() => String, {
    description: 'Описание проекта',
  })
  description!: string;

  @Field(() => String, {
    description: 'Приглашение к проекту',
  })
  invite!: string;

  @Field(() => String, {
    description: 'Мета-информация проекта',
  })
  meta!: string;

  @Field(() => String, {
    description: 'Данные/шаблон проекта',
  })
  data!: string;

  @Field(() => String, {
    description: 'Дата создания',
  })
  created_at!: string;

  @Field(() => CapitalProjectCountsDataOutputDTO, {
    description: 'Счетчики участников проекта',
  })
  counts!: CapitalProjectCountsDataOutputDTO;

  @Field(() => CapitalProjectPlanPoolOutputDTO, {
    description: 'Плановые показатели проекта',
  })
  plan!: CapitalProjectPlanPoolOutputDTO;

  @Field(() => CapitalProjectFactPoolOutputDTO, {
    description: 'Фактические показатели проекта',
  })
  fact!: CapitalProjectFactPoolOutputDTO;

  @Field(() => CapitalProjectCrpsDataOutputDTO, {
    description: 'Данные CRPS для распределения наград проекта',
  })
  crps!: CapitalProjectCrpsDataOutputDTO;

  @Field(() => CapitalProjectVotingDataOutputDTO, {
    description: 'Данные голосования по методу Водянова',
  })
  voting!: CapitalProjectVotingDataOutputDTO;

  @Field(() => ProjectPermissionsOutputDTO, {
    description: 'Права доступа текущего пользователя к проекту',
  })
  permissions!: ProjectPermissionsOutputDTO;
}

/**
 * GraphQL Output DTO для проекта-компонента
 * Наследуется от базового типа без дополнительных полей для избежания рекурсии
 */
@ObjectType('CapitalProjectComponent', {
  description: 'Проект-компонент в системе CAPITAL',
})
export class ProjectComponentOutputDTO extends BaseProjectOutputDTO {
  // Наследуется от BaseProjectOutputDTO без дополнительных полей
  // Это предотвращает циклические зависимости в GraphQL схеме
}

/**
 * GraphQL Output DTO для полного проекта с компонентами
 * Наследуется от базового типа и добавляет массив компонентов
 */
@ObjectType('CapitalProject', {
  description: 'Проект в системе CAPITAL с компонентами',
})
export class ProjectOutputDTO extends BaseProjectOutputDTO {
  @Field(() => [ProjectComponentOutputDTO], {
    description: 'Массив проектов-компонентов',
    defaultValue: [],
  })
  components?: ProjectComponentOutputDTO[];
}
