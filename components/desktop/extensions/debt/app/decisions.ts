import type { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { useSystemStore } from 'src/entities/System/model';
import { generateLoanDecision } from '../api';
import { t } from '../i18n';

/**
 * Обработчик решения совета о предоставлении беспроцентного займа
 * (`createdebt`): протокол формируется из данных заявления пайщика.
 */
export function registerDebtDecisionHandlers(): void {
  // Заём под коммиты (без ключа обеспечения) оформляет «Благорост»: его
  // обработчик, если он зарегистрировался раньше, получает такое заявление.
  const previous = decisionFactory.getHandler('createdebt');
  decisionFactory.registerHandler('createdebt', {
    generateHandler: async (args) => {
      const { decision_id, username, row } = args;
      if (!row.table?.statement?.meta) {
        throw new Error(t('debt.error.missingCreatedebtMeta'));
      }

      const meta = JSON.parse(row.table.statement.meta) as Cooperative.Registry.GetLoanStatement.Action;
      if (!meta.collateral && previous) {
        return previous.generateHandler(args);
      }
      if (!meta.debt_hash || !meta.amount || !meta.due_at || !meta.collateral) {
        throw new Error(t('debt.error.invalidCreatedebtMeta'));
      }

      const { info } = useSystemStore();

      // Протокол формируется на имя заёмщика: по нему фабрика находит договор-основание.
      // Данные заседания она берёт сама по номеру решения; подписывает протокол председатель.
      return generateLoanDecision({
        coopname: info.coopname,
        username,
        debt_hash: meta.debt_hash,
        amount: meta.amount,
        due_at: meta.due_at,
        collateral: meta.collateral,
        decision_id,
      });
    },
  });
}
