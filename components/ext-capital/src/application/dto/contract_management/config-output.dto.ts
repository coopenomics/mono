import { ObjectType, Field, Float } from '@nestjs/graphql';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL DTO для конфигурации CAPITAL контракта
 */
@ObjectType('CapitalConfigObject', {
  description: 'Конфигурация CAPITAL контракта кооператива',
})
export class ConfigDTO {
  @Field(() => Float, {
    description: 'Процент бонуса координатора',
  })
  coordinator_bonus_percent!: number;

  @Field(() => Float, {
    description: 'Процент расходов',
  })
  expense_pool_percent!: number;

  @Field(() => Float, {
    description: 'Срок действия приглашения координатора в днях',
  })
  coordinator_invite_validity_days!: number;

  @Field(() => Float, {
    description: 'Период голосования в днях',
  })
  voting_period_in_days!: number;

  @Field(() => Float, {
    description: 'Процент голосования авторов',
  })
  authors_voting_percent!: number;

  @Field(() => Float, {
    description: 'Процент голосования создателей',
  })
  creators_voting_percent!: number;

  @Field(() => Float, {
    description: 'Скорость убывания энергии в день',
  })
  energy_decay_rate_per_day!: number;

  @Field(() => Float, {
    description: 'Базовая глубина уровня',
  })
  level_depth_base!: number;

  @Field(() => Float, {
    description: 'Коэффициент роста уровня',
  })
  level_growth_coefficient!: number;

  @Field(() => Float, {
    description: 'Коэффициент получения энергии',
  })
  energy_gain_coefficient!: number;
}

/**
 * GraphQL Output DTO для полного состояния CAPITAL контракта
 */
@ObjectType('CapitalState', {
  description: 'Полное состояние CAPITAL контракта кооператива',
})
export class StateOutputDTO extends BaseOutputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Глобальный пул доступных для аллокации инвестиций в программу',
  })
  global_available_invest_pool!: string;

  @Field(() => String, {
    description: 'Общая сумма членских взносов по программе',
  })
  program_membership_funded!: string;

  @Field(() => String, {
    description: 'Доступная сумма членских взносов по программе',
  })
  program_membership_available!: string;

  @Field(() => String, {
    description: 'Распределенная сумма членских взносов по программе',
  })
  program_membership_distributed!: string;

  @Field(() => Float, {
    description: 'Накопительное вознаграждение на долю в членских взносах',
  })
  program_membership_cumulative_reward_per_share?: number;

  @Field(() => ConfigDTO, {
    description: 'Управляемая конфигурация контракта',
  })
  config!: ConfigDTO;
}
