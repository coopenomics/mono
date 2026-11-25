import { Field, ObjectType } from '@nestjs/graphql';
import type {
  MarketplaceBranchSummaryMovementView,
  MarketplaceBranchSummaryView,
} from '../services/marketplace-branch-summary.service';
import { WorkingHoursDTO } from './working-hours.dto';

@ObjectType('MarketplaceBranchSummaryIssuancePoint', {
  description: 'Пункт выдачи заказов на кооперативном участке.',
})
export class MarketplaceBranchSummaryIssuancePointDTO {
  @Field(() => WorkingHoursDTO, { description: 'Режим работы пункта выдачи по дням недели.' })
  working_hours!: WorkingHoursDTO;

  @Field(() => Boolean, { description: 'Пункт выдачи работает и принимает заказы.' })
  active!: boolean;
}

@ObjectType('MarketplaceBranchSummaryInitiators', {
  description: 'Паевые взносы инициаторов кооперативного участка одной строкой итогов.',
})
export class MarketplaceBranchSummaryInitiatorsDTO {
  @Field(() => String, { description: 'Внесено инициаторами деньгами.' })
  money_total!: string;

  @Field(() => String, { description: 'Внесено инициаторами имуществом.' })
  property_total!: string;

  @Field(() => String, { description: 'Возмещено инициаторам из экономии участка.' })
  repaid_total!: string;

  @Field(() => String, { description: 'Осталось возместить инициаторам.' })
  outstanding!: string;
}

@ObjectType('MarketplaceBranchSummary', {
  description:
    'Сводка кооперативного участка для пайщика: пункт выдачи заказов, кошельки участка и взносы инициаторов. Раздел пуст, когда участок в нём не участвует.',
})
export class MarketplaceBranchSummaryDTO {
  @Field(() => String, { description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => MarketplaceBranchSummaryIssuancePointDTO, {
    nullable: true,
    description: 'Пункт выдачи заказов участка. Пусто, когда участок не подключён как пункт выдачи.',
  })
  issuance_point?: MarketplaceBranchSummaryIssuancePointDTO | null;

  @Field(() => String, { description: 'Остаток общего кошелька участка.' })
  common_balance!: string;

  @Field(() => String, {
    description: 'Остаток фонда социально-экономического взаимодействия и социального обеспечения по участку.',
  })
  social_fund_balance!: string;

  @Field(() => MarketplaceBranchSummaryInitiatorsDTO, {
    nullable: true,
    description: 'Взносы инициаторов участка. Пусто, когда инициаторов у участка нет.',
  })
  initiators?: MarketplaceBranchSummaryInitiatorsDTO | null;
}

@ObjectType('MarketplaceBranchSummaryMovement', {
  description: 'Движение по общему кошельку участка для пайщика: дата, операция и сумма.',
})
export class MarketplaceBranchSummaryMovementDTO {
  @Field(() => String, { description: 'Порядковый номер операции в реестре движений.' })
  global_sequence!: string;

  @Field(() => String, { description: 'Код операции: поступление членского взноса, распределение, оплата расхода.' })
  operation_code!: string;

  @Field(() => String, { nullable: true, description: 'Сумма движения.' })
  quantity?: string | null;

  @Field(() => Date, { description: 'Дата и время операции.' })
  created_at!: Date;
}

type ToAsset = (units: bigint) => string;

export function toMarketplaceBranchSummaryDTO(view: MarketplaceBranchSummaryView, toAsset: ToAsset): MarketplaceBranchSummaryDTO {
  return {
    braname: view.braname,
    issuance_point: view.issuance_point
      ? { working_hours: view.issuance_point.working_hours as WorkingHoursDTO, active: view.issuance_point.active }
      : null,
    common_balance: view.common_balance,
    social_fund_balance: view.social_fund_balance,
    initiators: view.initiators
      ? {
          money_total: toAsset(view.initiators.money_total),
          property_total: toAsset(view.initiators.property_total),
          repaid_total: toAsset(view.initiators.repaid_total),
          outstanding: toAsset(view.initiators.outstanding),
        }
      : null,
  };
}

export function toMarketplaceBranchSummaryMovementDTO(view: MarketplaceBranchSummaryMovementView): MarketplaceBranchSummaryMovementDTO {
  return { ...view };
}
