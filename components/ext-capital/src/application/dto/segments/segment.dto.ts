import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { SegmentStatus } from '../../../domain/enums/segment-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сегмента участника в проекте CAPITAL
 */
@ObjectType('CapitalSegment', {
  description: 'Сегмент участника в проекте CAPITAL',
})
export class SegmentOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => SegmentStatus, {
    description: 'Статус сегмента',
  })
  status!: SegmentStatus;

  @Field(() => Boolean, {
    description: 'Завершена ли конвертация сегмента',
    defaultValue: false,
  })
  is_completed!: boolean;

  @Field(() => String, {
    description: 'Хеш проекта',
  })
  project_hash!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Имя пользователя',
  })
  username!: string;

  @Field(() => String, {
    description: 'Отображаемое имя пользователя',
  })
  display_name!: string;

  // Роли участника в проекте
  @Field(() => Boolean, {
    description: 'Роль автора',
  })
  is_author!: boolean;

  @Field(() => Boolean, {
    description: 'Роль создателя',
  })
  is_creator!: boolean;

  @Field(() => Boolean, {
    description: 'Роль координатора',
  })
  is_coordinator!: boolean;

  @Field(() => Boolean, {
    description: 'Роль инвестора',
  })
  is_investor!: boolean;

  @Field(() => Boolean, {
    description: 'Роль собственника',
  })
  is_propertor!: boolean;

  @Field(() => Boolean, {
    description: 'Роль участника',
  })
  is_contributor!: boolean;

  @Field(() => Boolean, {
    description: 'Наличие права голоса',
  })
  has_vote!: boolean;

  // Вклады инвестора
  @Field(() => String, {
    description: 'Сумма инвестиций инвестора',
  })
  investor_amount!: string;

  @Field(() => String, {
    description: 'Базовый вклад инвестора',
  })
  investor_base!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад участника словами участника',
  })
  value?: string;

  // Вклады создателя
  @Field(() => String, {
    description: 'Базовый вклад создателя',
  })
  creator_base!: string;

  @Field(() => String, {
    description: 'Бонусный вклад создателя',
  })
  creator_bonus!: string;

  // Вклады автора
  @Field(() => String, {
    description: 'Базовый вклад автора',
  })
  author_base!: string;

  @Field(() => String, {
    description: 'Бонусный вклад автора',
  })
  author_bonus!: string;

  // Вклады координатора
  @Field(() => String, {
    description: 'Инвестиции координатора',
  })
  coordinator_investments!: string;

  @Field(() => String, {
    description: 'Базовый вклад координатора',
  })
  coordinator_base!: string;

  // Вклады участника
  @Field(() => String, {
    description: 'Бонусный вклад участника',
  })
  contributor_bonus!: string;

  // Имущественные взносы
  @Field(() => String, {
    description: 'Базовый имущественный вклад',
  })
  property_base!: string;

  // CRPS поля для масштабируемого распределения наград
  @Field(() => Float, {
    description: 'Последняя награда за базовый вклад автора на долю в проекте',
  })
  last_author_base_reward_per_share!: number;

  @Field(() => Float, {
    description: 'Последняя награда за бонусный вклад автора на долю в проекте',
  })
  last_author_bonus_reward_per_share!: number;

  @Field(() => Float, {
    description: 'Последняя награда участника на акцию',
  })
  last_contributor_reward_per_share!: number;

  // Доли в программе и проекте
  @Field(() => String, {
    description: 'Доли участников капитала',
  })
  capital_contributor_shares!: string;

  // Последняя известная сумма инвестиций в проекте для расчета provisional_amount
  @Field(() => String, {
    description: 'Последняя известная сумма инвестиций в проекте',
  })
  last_known_invest_pool!: string;

  // Последняя известная сумма базового пула создателей для расчета использования инвестиций
  @Field(() => String, {
    description: 'Последняя известная сумма базового пула создателей',
  })
  last_known_creators_base_pool!: string;

  // Последняя известная сумма инвестиций координаторов для отслеживания изменений
  @Field(() => String, {
    description: 'Последняя известная сумма инвестиций координаторов',
  })
  last_known_coordinators_investment_pool!: string;

  // Финансовые данные для ссуд
  @Field(() => String, {
    description: 'Предварительная сумма',
  })
  provisional_amount!: string;

  @Field(() => String, {
    description: 'Сумма долга',
  })
  debt_amount!: string;

  @Field(() => String, {
    description: 'Сумма погашенного долга',
  })
  debt_settled!: string;

  // Пулы равных премий авторов и прямых премий создателей
  @Field(() => String, {
    description: 'Равный бонус автора',
  })
  equal_author_bonus!: string;

  @Field(() => String, {
    description: 'Прямой бонус создателя',
  })
  direct_creator_bonus!: string;

  // Результаты голосования по методу Водянова
  @Field(() => String, {
    description: 'Бонус голосования',
  })
  voting_bonus!: string;

  @Field(() => Boolean, {
    description: 'Флаг завершения расчета голосования',
  })
  is_votes_calculated!: boolean;

  // Общая стоимость сегмента (рассчитывается автоматически)
  @Field(() => String, {
    description: 'Общая базовая стоимость сегмента',
  })
  total_segment_base_cost!: string;

  @Field(() => String, {
    description: 'Общая бонусная стоимость сегмента',
  })
  total_segment_bonus_cost!: string;

  @Field(() => String, {
    description: 'Общая стоимость сегмента',
  })
  total_segment_cost!: string;

  @Field(() => String, {
    description: 'Интеллектуальная стоимость сегмента',
  })
  intellectual_cost!: string;

  @Field(() => Float, {
    description: 'Доля участника в результате интеллектуальной деятельности',
  })
  share_percent!: number;

  @Field(() => String, {
    description: 'Доступная сумма для конвертации в программу',
  })
  available_for_program!: string;

  @Field(() => String, {
    description: 'Доступная сумма для конвертации в кошелек',
  })
  available_for_wallet!: string;
}
