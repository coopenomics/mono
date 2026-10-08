import type { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { generateLoanDecision } from '../api';
import { t } from '../i18n';

/**
 * Обработчик решения совета о предоставлении беспроцентного займа
 * (`createdebt`): протокол формируется из данных заявления пайщика.
 */
export function registerDebtDecisionHandlers(): void {
  decisionFactory.registerHandler('createdebt', {
    generateHandler: async ({ decision_id, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('debt.error.missingCreatedebtMeta'));
      }

      const meta = JSON.parse(row.table.statement.meta) as Cooperative.Registry.GetLoanStatement.Action;
      if (!meta.debt_hash || !meta.amount || !meta.due_at || !meta.collateral) {
        throw new Error(t('debt.error.invalidCreatedebtMeta'));
      }

      const { info } = useSystemStore();
      const session = useSessionStore();

      // Протокол подписывает председатель — документ формируется на его имя.
      // Данные заседания фабрика берёт сама по номеру решения.
      return generateLoanDecision({
        coopname: info.coopname,
        username: session.username,
        debt_hash: meta.debt_hash,
        amount: meta.amount,
        due_at: meta.due_at,
        collateral: meta.collateral,
        decision_id,
      });
    },
  });
}
