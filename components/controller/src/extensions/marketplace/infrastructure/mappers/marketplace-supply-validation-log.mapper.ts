import { Injectable } from '@nestjs/common';
import { MarketplaceSupplyValidationLogDomainEntity } from '../../domain/entities/marketplace-supply-validation-log.entity';
import { MarketplaceSupplyValidationLogEntity } from '../entities/marketplace-supply-validation-log.entity';

@Injectable()
export class MarketplaceSupplyValidationLogMapper {
  toDomain(row: MarketplaceSupplyValidationLogEntity): MarketplaceSupplyValidationLogDomainEntity {
    return new MarketplaceSupplyValidationLogDomainEntity({
      id: row.id,
      coopname: row.coopname,
      cycle_id: row.cycle_id,
      offerer_account: row.offerer_account,
      outcome: row.outcome,
      reason: row.reason,
      reason_code: row.reason_code,
      attempted_groups: row.attempted_groups,
      created_at: row.created_at,
    });
  }
}
