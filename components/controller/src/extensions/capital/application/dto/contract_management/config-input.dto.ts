import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, Min, Max } from 'class-validator';
import { t } from '../../../i18n';

/**
 * DTO для конфигурации CAPITAL контракта
 */
@InputType('ConfigInput')
export class ConfigInputDTO {
  @Field(() => Number, { description: 'Процент бонуса координатора' })
  @IsNumber({}, { message: t('capital.configInput.coordinatorBonusPercent.number') })
  @Min(0, { message: t('capital.configInput.coordinatorBonusPercent.min') })
  @Max(100, { message: t('capital.configInput.coordinatorBonusPercent.max') })
  coordinator_bonus_percent!: number;

  @Field(() => Number, { description: 'Процент расходов' })
  @IsNumber({}, { message: t('capital.configInput.expensePoolPercent.number') })
  @Min(0, { message: t('capital.configInput.expensePoolPercent.min') })
  @Max(100, { message: t('capital.configInput.expensePoolPercent.max') })
  expense_pool_percent!: number;

  @Field(() => Number, { description: 'Срок действия приглашения координатора в днях' })
  @IsNumber({}, { message: t('capital.configInput.coordinatorInviteValidityDays.number') })
  @Min(1, { message: t('capital.configInput.coordinatorInviteValidityDays.min') })
  coordinator_invite_validity_days!: number;

  @Field(() => Number, { description: 'Период голосования в днях' })
  @IsNumber({}, { message: t('capital.configInput.votingPeriodInDays.number') })
  @Min(1, { message: t('capital.configInput.votingPeriodInDays.min') })
  voting_period_in_days!: number;

  @Field(() => Number, { description: 'Процент голосования авторов' })
  @IsNumber({}, { message: t('capital.configInput.authorsVotingPercent.number') })
  @Min(0, { message: t('capital.configInput.authorsVotingPercent.min') })
  @Max(100, { message: t('capital.configInput.authorsVotingPercent.max') })
  authors_voting_percent!: number;

  @Field(() => Number, { description: 'Процент голосования создателей' })
  @IsNumber({}, { message: t('capital.configInput.creatorsVotingPercent.number') })
  @Min(0, { message: t('capital.configInput.creatorsVotingPercent.min') })
  @Max(100, { message: t('capital.configInput.creatorsVotingPercent.max') })
  creators_voting_percent!: number;

  @Field(() => Number, { description: 'Скорость убывания энергии в день' })
  @IsNumber({}, { message: t('capital.configInput.energyDecayRatePerDay.number') })
  @Min(0, { message: t('capital.configInput.energyDecayRatePerDay.min') })
  energy_decay_rate_per_day!: number;

  @Field(() => Number, { description: 'Базовая глубина уровня' })
  @IsNumber({}, { message: t('capital.configInput.levelDepthBase.number') })
  @Min(1, { message: t('capital.configInput.levelDepthBase.min') })
  level_depth_base!: number;

  @Field(() => Number, { description: 'Коэффициент роста уровня' })
  @IsNumber({}, { message: t('capital.configInput.levelGrowthCoefficient.number') })
  @Min(0, { message: t('capital.configInput.levelGrowthCoefficient.min') })
  level_growth_coefficient!: number;

  @Field(() => Number, { description: 'Коэффициент получения энергии' })
  @IsNumber({}, { message: t('capital.configInput.energyGainCoefficient.number') })
  @Min(0, { message: t('capital.configInput.energyGainCoefficient.min') })
  energy_gain_coefficient!: number;
}
