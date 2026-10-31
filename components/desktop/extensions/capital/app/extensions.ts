import type { Registry } from '@coopenomics/docs-templates';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { proposalHeaderOf } from 'src/shared/lib/expenses';
import { ExpenseProposalDecisionInfo } from 'src/shared/ui/domain/ExpenseProposalDecisionInfo';
import { generateExpenseProposalDecisionDocument } from 'app/extensions/expenses/api';
import { useGenerateResultContributionDecision } from '../features/Result/GenerateResultContributionDecision/model';
import { CreateResultDecisionInfoWidget } from '../widgets/CreateResultDecisionInfoWidget';
import { programPropertyApi } from '../features/ProgramProperty';
import { t } from '../i18n';

/**
 * Регистрация обработчиков решений для расширения capital
 * Этот файл содержит регистрацию обработчиков решений для расширения capital
 */
/**
 * Паевой взнос имуществом в «Благорост» (createpgprp): протокол 1071
 * собирается из полей заявления 1070 и номера решения. Имя в протоколе —
 * пайщик из заявления: по нему фабрика берёт реквизиты его договоров.
 */
function registerProgramPropertyDecisionHandler() {
  decisionFactory.registerHandler('createpgprp', {
    generateHandler: async ({ decision_id, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('capital.error.missingCreatepgprpMeta'));
      }
      const meta = JSON.parse(row.table.statement.meta) as Registry.CapitalizationPropertyInvestStatement.Action;
      return await programPropertyApi.generateDecision({
        coopname: meta.coopname,
        username: meta.username,
        decision_id,
        property_hash: meta.property_hash,
        property_form: meta.property_form,
        property_name: meta.property_name,
        property_description: meta.property_description,
        property_quantity: meta.property_quantity,
        property_unit: meta.property_unit,
        property_amount: meta.property_amount,
      });
    },
  });
}

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

  registerProgramPropertyDecisionHandler();

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
      ) as Registry.ExpenseProposalStatement.Action;

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
    // Сводка записки над документами вопроса: цель, сумма, срок, позиции с получателями.
    infoComponent: ExpenseProposalDecisionInfo,
    // Все записки называются одинаково («Служебная записка-смета о расходах»),
    // в повестке их различает цель расходов из заявления.
    titleDetail: (agenda) => proposalHeaderOf(agenda.table?.statement?.meta)?.description,
  });
}
