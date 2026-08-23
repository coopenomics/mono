import type { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { generateExpenseProposalDecisionDocument } from 'app/extensions/expenses/api';
import { useGenerateResultContributionDecision } from '../features/Result/GenerateResultContributionDecision/model';
import { CreateResultDecisionInfoWidget } from '../widgets/CreateResultDecisionInfoWidget';

/**
 * Регистрация обработчиков решений для расширения capital
 * Этот файл содержит регистрацию обработчиков решений для расширения capital
 */
export function registerCapitalDecisionHandlers() {
  // Обработчик для createresult (решение о приросте благороста из задания)
  decisionFactory.registerHandler('createresult', {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(
          'Отсутствуют метаданные заявления для решения createresult',
        );
      }

      // const parsedDocumentMeta = JSON.parse(row.table.statement.meta) as {
      //   result_hash: string;
      // };

      const parsedDocumentMeta = JSON.parse(row.table.statement.meta) as {
        result_hash: string;
      };

      const { generateResultContributionDecision } =
        useGenerateResultContributionDecision();

      return await generateResultContributionDecision({
        result_hash: parsedDocumentMeta.result_hash,
        decision_id,
        username,
      });
    },
    // Компонент для отображения дополнительной информации
    infoComponent: CreateResultDecisionInfoWidget,
  });

  // Обработчик для createexp (служебная записка-смета о расходах, шасси expense).
  // Живёт в capital, пока расширение expenses не подключено в extensions-registry:
  // программные расходы создаются со стола capital.
  decisionFactory.registerHandler('createexp', {
    generateHandler: async ({ decision_id, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error('Отсутствуют метаданные заявления для решения createexp');
      }

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.ExpenseProposalStatement.Action;

      if (!parsedDocumentMeta.proposal_hash || !parsedDocumentMeta.items?.length) {
        throw new Error('Некорректные метаданные заявления для решения createexp');
      }

      const { info } = useSystemStore();
      const session = useSessionStore();

      // Протокол решения подписывает председатель — документ генерируется на его
      // имя. Данные собрания (кворум, голоса, № протокола) фабрика берёт сама
      // по decision_id — канон протоколов решений совета.
      const generated = await generateExpenseProposalDecisionDocument({
        coopname: info.coopname,
        username: session.username,
        proposal_hash: parsedDocumentMeta.proposal_hash,
        decision_id,
        proposal: parsedDocumentMeta.proposal,
        items: parsedDocumentMeta.items,
        resolution: { kind: 'approve' },
      } as any);

      return (generated as any).generateExpenseProposalDecisionDocument;
    },
  });
}
