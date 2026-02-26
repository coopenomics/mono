import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, Min, Max } from 'class-validator';

/**
 * DTO для конфигурации CAPITAL контракта
 */
@InputType('ConfigInput')
export class ConfigInputDTO {
  @Field(() => Number, { description: 'Процент бонуса координатора' })
  @IsNumber({}, { message: 'Процент бонуса координатора должен быть числом' })
  @Min(0, { message: 'Процент бонуса координатора не может быть отрицательным' })
  @Max(100, { message: 'Процент бонуса координатора не может превышать 100' })
  coordinator_bonus_percent!: number;

  @Field(() => Number, { description: 'Процент расходов' })
  @IsNumber({}, { message: 'Процент расходов должен быть числом' })
  @Min(0, { message: 'Процент расходов не может быть отрицательным' })
  @Max(100, { message: 'Процент расходов не может превышать 100' })
  expense_pool_percent!: number;

  @Field(() => Number, { description: 'Срок действия приглашения координатора в днях' })
  @IsNumber({}, { message: 'Срок действия приглашения должен быть числом' })
  @Min(1, { message: 'Срок действия приглашения должен быть не менее 1 дня' })
  coordinator_invite_validity_days!: number;

  @Field(() => Number, { description: 'Период голосования в днях' })
  @IsNumber({}, { message: 'Период голосования должен быть числом' })
  @Min(1, { message: 'Период голосования должен быть не менее 1 дня' })
  voting_period_in_days!: number;

  @Field(() => Number, { description: 'Процент голосования авторов' })
  @IsNumber({}, { message: 'Процент голосования авторов должен быть числом' })
  @Min(0, { message: 'Процент голосования авторов не может быть отрицательным' })
  @Max(100, { message: 'Процент голосования авторов не может превышать 100' })
  authors_voting_percent!: number;

  @Field(() => Number, { description: 'Процент голосования создателей' })
  @IsNumber({}, { message: 'Процент голосования создателей должен быть числом' })
  @Min(0, { message: 'Процент голосования создателей не может быть отрицательным' })
  @Max(100, { message: 'Процент голосования создателей не может превышать 100' })
  creators_voting_percent!: number;

  @Field(() => Number, { description: 'Скорость убывания энергии в день' })
  @IsNumber({}, { message: 'Скорость убывания энергии должна быть числом' })
  @Min(0, { message: 'Скорость убывания энергии не может быть отрицательной' })
  energy_decay_rate_per_day!: number;

  @Field(() => Number, { description: 'Базовая глубина уровня' })
  @IsNumber({}, { message: 'Базовая глубина уровня должна быть числом' })
  @Min(1, { message: 'Базовая глубина уровня должна быть не менее 1' })
  level_depth_base!: number;

  @Field(() => Number, { description: 'Коэффициент роста уровня' })
  @IsNumber({}, { message: 'Коэффициент роста уровня должен быть числом' })
  @Min(0, { message: 'Коэффициент роста уровня не может быть отрицательным' })
  level_growth_coefficient!: number;

  @Field(() => Number, { description: 'Коэффициент получения энергии' })
  @IsNumber({}, { message: 'Коэффициент получения энергии должен быть числом' })
  @Min(0, { message: 'Коэффициент получения энергии не может быть отрицательным' })
  energy_gain_coefficient!: number;
}
