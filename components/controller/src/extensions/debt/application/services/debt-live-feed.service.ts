import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { EntityName as LoansTable } from '../../infrastructure/entities/loan.record';

/**
 * Зеркало займов в ленте изменений: список займов у пайщика и реестр у совета
 * перечитываются сами, когда совет принял решение, председатель подписал
 * договор, кассир выплатил или пайщик вернул заём.
 */
@Injectable()
export class DebtLiveFeedService implements OnModuleInit {
  constructor(@Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null) {}

  onModuleInit(): void {
    // Заём — его заёмщику и совету.
    this.chainChanges?.declareLocalTables([{ code: 'debt', table: LoansTable, owner_field: 'username' }]);
  }
}
