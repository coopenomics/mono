import type { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { generateExpenseProposalDecisionDocument } from 'app/extensions/expenses/api';
import { useGenerateResultContributionDecision } from '../features/Result/GenerateResultContributionDecision/model';
import { CreateResultDecisionInfoWidget } from '../widgets/CreateResultDecisionInfoWidget';
import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { t } from '../i18n';

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
          t('capital.error.missingCreateresultMeta'),
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
        throw new Error(t('capital.error.missingCreateexpMeta'));
      }

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.ExpenseProposalStatement.Action;

      if (!parsedDocumentMeta.proposal_hash || !parsedDocumentMeta.items?.length) {
        throw new Error(t('capital.error.invalidCreateexpMeta'));
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

  registerDebtDecisionHandler();
}

/**
 * Обработчик для createdebt (решение совета о беспроцентном займе). Заём под
 * коммиты несёт в заявлении номер приложения об ответственном хранении; заём
 * под паевой взнос — ключ обеспечения, его протокол формирует обработчик
 * приложения «Беспроцентные займы», если оно зарегистрировалось раньше.
 */
function registerDebtDecisionHandler(): void {
  const previousDebtHandler = decisionFactory.getHandler('createdebt');
  decisionFactory.registerHandler('createdebt', {
    generateHandler: async (args) => {
      const { decision_id, username, row } = args;
      if (!row.table?.statement?.meta) {
        throw new Error(t('capital.error.missingCreatedebtMeta'));
      }

      const meta = JSON.parse(row.table.statement.meta) as Cooperative.Registry.GetLoanStatement.Action;
      if (meta.collateral && previousDebtHandler) {
        return previousDebtHandler.generateHandler(args);
      }
      if (!meta.debt_hash || !meta.amount || !meta.due_at) {
        throw new Error(t('capital.error.invalidCreatedebtMeta'));
      }

      const { info } = useSystemStore();

      // Протокол формируется на имя заёмщика: по нему фабрика находит договор-основание.
      const { [Mutations.Capital.GenerateGetLoanDecision.name]: generated } = await client.Mutation(
        Mutations.Capital.GenerateGetLoanDecision.mutation,
        {
          variables: {
            data: {
              coopname: info.coopname,
              username,
              debt_hash: meta.debt_hash,
              amount: meta.amount,
              due_at: meta.due_at,
              storage_appendix_number: meta.storage_appendix_number,
              decision_id,
            },
            options: { lang: 'ru' },
          },
        },
      );
      return generated;
    },
  });
}
