import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ExpensePlanEntity } from './infrastructure/entities/expense-plan.entity';
import {
  EXPENSE_PLANS_SERVICE,
  ExpensePlansService,
} from './application/services/expense-plans.service';
import { ExpensePlansResolver } from './application/resolvers/expense-plans.resolver';

/**
 * Общесистемное расширение «Расходы» (requirement b6 «Экономика КУ»,
 * раунд 5): оффчейн-реестр плановых расходов кооператива и его участков +
 * расчёт 30-дневного резерва. Сюда же позже встанет шасси расходов
 * (контракт `expense`, PR #61/#67) — план-записи совместятся с его
 * процессами, путь оплаты расходов включится вместе с ним.
 */
@Module({
  imports: [NestTypeOrmModule.forFeature([ExpensePlanEntity])],
  providers: [
    ExpensePlansService,
    { provide: EXPENSE_PLANS_SERVICE, useExisting: ExpensePlansService },
    ExpensePlansResolver,
  ],
  exports: [ExpensePlansService, EXPENSE_PLANS_SERVICE],
})
export class ExpensesPluginModule {}
