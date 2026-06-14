import { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { DigitalDocument } from 'src/shared/lib/document';
import { useSystemStore } from 'src/entities/System/model';
import { useGenerateFreeDecision } from 'src/features/FreeDecision/GenerateDecision';
import { useGenerateParticipantApplicationDecision } from 'src/features/Decision/ParticipantApplication';
import { useGenerateSovietDecisionOnAnnualMeet } from 'src/features/Meet/GenerateSovietDecision/model';
import { useGenerateReturnByMoneyDecision } from 'src/features/Wallet/GenerateReturnByMoneyDecision';

/**
 * Регистрация обработчиков базовых решений
 * Этот файл содержит регистрацию всех встроенных обработчиков решений
 */
export function registerBaseDecisionHandlers() {
  // Обработчик для FreeDecision (свободное решение)
  decisionFactory.registerHandler('freedecision', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error('Отсутствуют метаданные заявления для решения freedecision');
      }

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.FreeDecision.Action;

      if (!parsedDocumentMeta.project_id) {
        throw new Error('Отсутствует project_id в метаданных заявления');
      }

      const { generateFreeDecision } = useGenerateFreeDecision();
      return await generateFreeDecision({
        username,
        decision_id,
        project_id: parsedDocumentMeta.project_id,
      });
    },
  });

  // Обработчик для DecisionOfParticipantApplication (решение о приеме участника)
  decisionFactory.registerHandler('joincoop', {
    generateHandler: async ({ decision_id, username }) => {
      const { generateParticipantApplicationDecision } =
        useGenerateParticipantApplicationDecision();
      return await generateParticipantApplicationDecision({
        username,
        decision_id,
      });
    },
  });

  // Обработчик для AnnualGeneralMeetingSovietDecision (решение совета о годовом собрании)
  decisionFactory.registerHandler('creategm', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error('Отсутствуют метаданные заявления для решения creategm');
      }

      if (!row.table?.hash) {
        throw new Error('Отсутствует hash для решения creategm');
      }

      const { generateSovietDecisionOnAnnualMeet } =
        useGenerateSovietDecisionOnAnnualMeet();
      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.AnnualGeneralMeetingAgenda.Action;
      const is_repeated = parsedDocumentMeta.is_repeated || false;

      return await generateSovietDecisionOnAnnualMeet({
        username,
        decision_id,
        meet_hash: row.table.hash,
        is_repeated,
      });
    },
  });

  // Обработчик для ReturnByMoneyDecision (решение о возврате денег)
  decisionFactory.registerHandler('createwthd', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error('Отсутствуют метаданные заявления для решения createwthd');
      }

      const { generateReturnByMoneyDecision } =
        useGenerateReturnByMoneyDecision();

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.ReturnByMoney.Action;

      if (!parsedDocumentMeta.payment_hash || !parsedDocumentMeta.quantity || !parsedDocumentMeta.currency) {
        throw new Error('Некорректные метаданные заявления для решения createwthd');
      }

      return await generateReturnByMoneyDecision({
        username,
        decision_id,
        payment_hash: parsedDocumentMeta.payment_hash,
        quantity: parsedDocumentMeta.quantity,
        currency: parsedDocumentMeta.currency,
      });
    },
  });

  // Обработчик для MarketplaceWriteoffProtocol (протокол совета о списании
  // скоропорта со складов кооперативных участков, ЦПП «Стол заказов»).
  // Документ-Решение совета (registry 1107) генерируется из метаданных
  // подписанного Заявления о списании (1108) + decision_id текущего решения.
  // Фабрика сама резолвит состав совета, голоса и реквизиты кооператива по
  // decision_id — клиенту достаточно проброса итоговых полей проекта.
  decisionFactory.registerHandler('mktwroff', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error('Отсутствуют метаданные заявления для решения mktwroff');
      }

      const statementMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.MarketplaceWriteoffStatement.Action;

      if (!statementMeta.proposal_hash || !Array.isArray(statementMeta.items)) {
        throw new Error('Некорректные метаданные заявления для решения mktwroff');
      }

      const { info } = useSystemStore();

      const protocolAction: Cooperative.Registry.MarketplaceWriteoffProtocol.Action =
        {
          registry_id:
            Cooperative.Registry.MarketplaceWriteoffProtocol.registry_id,
          coopname: info.coopname,
          username,
          lang: 'ru',
          decision_id,
          proposal_hash: statementMeta.proposal_hash,
          cycle_started_at: statementMeta.cycle_started_at,
          total_amount: statementMeta.total_amount,
          items_count: statementMeta.items.length,
        };

      return await new DigitalDocument().generate(protocolAction, {
        lang: 'ru',
      });
    },
  });
}
