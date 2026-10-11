import { Cooperative } from 'cooptypes';
import { decisionFactory, type IGenerateDecisionData } from 'src/shared/lib/decision-factory';
import { DigitalDocument, type IGeneratedDocument } from 'src/shared/lib/document';
import { useSystemStore } from 'src/entities/System/model';
import { useGenerateFreeDecision } from 'src/features/FreeDecision/GenerateDecision';
import {
  ParticipantIntakeInfo,
  useGenerateParticipantApplicationDecision,
} from 'src/features/Decision/ParticipantApplication';
import { useGenerateSovietDecisionOnAnnualMeet } from 'src/features/Meet/GenerateSovietDecision/model';
import { useGenerateReturnByMoneyDecision } from 'src/features/Wallet/GenerateReturnByMoneyDecision';
import { useGenerateEstablishmentDecision } from 'src/features/Ku/GenerateEstablishmentDecision';
import { useGenerateMembershipExitDecision } from 'src/features/Membership/GenerateMembershipExitDecision';
import { t } from 'src/shared/i18n';

/** Поля метаданных заявления, которые фабрика документов проставляет сама. */
const META_SERVICE_KEYS = new Set([
  'title', 'registry_id', 'lang', 'generator', 'version', 'coopname', 'username', 'created_at', 'block_num', 'timezone', 'links',
]);

/**
 * Протокол решения из реестра типов решений, собранный из заявления: номер
 * шаблона протокола — из реестра, прикладные поля — из метаданных
 * подписанного заявления, автор и номер — из самого решения. Тот же способ,
 * которым протокол собирает робот совета (`RobotDecisionService.protocolData`):
 * ручное утверждение и робот обязаны давать один и тот же документ.
 *
 * Работает для любого решения реестра, чьи поля протокола выводятся из
 * заявления, — так утверждаются выдача имущества пайщику (`mktissue`) и отмена
 * сделки по гарантийному возврату (`mktretrn`). Тип вне реестра не его забота.
 */
async function generateProtocolFromStatement(
  decisionType: string,
  { decision_id, username, row }: IGenerateDecisionData,
): Promise<IGeneratedDocument | null> {
  const typeInfo = Cooperative.Document.decisionTypesRegistry[decisionType];
  if (!typeInfo) return null;

  const rawMeta = row.table?.statement?.meta;
  if (!rawMeta) {
    throw new Error(t('processDecisions.error.statementMetaMissing'));
  }
  const statementMeta = (typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta) as Record<string, unknown>;
  const business = Object.fromEntries(
    Object.entries(statementMeta).filter(([key]) => !META_SERVICE_KEYS.has(key)),
  );

  const { info } = useSystemStore();
  const hash = row.table?.hash ? String(row.table.hash) : '';
  const data: Record<string, unknown> = {
    ...business,
    registry_id: typeInfo.protocol_registry_id,
    coopname: info.coopname,
    username,
    lang: 'ru',
    decision_id,
    decision_hash: hash,
  };
  // Поля протокола, которых в заявлении нет буквально, но они выводятся из него
  // или из самого решения.
  if (Array.isArray(business.items) && data.items_count === undefined) data.items_count = business.items.length;
  if (data.receiver === undefined) data.receiver = username;
  if (data.meet_hash === undefined && hash) data.meet_hash = hash;

  return await new DigitalDocument().generate(data as never, { lang: 'ru' });
}

/**
 * Регистрация обработчиков базовых решений
 * Этот файл содержит регистрацию всех встроенных обработчиков решений
 */
export function registerBaseDecisionHandlers() {
  // Решение из реестра без собственного обработчика утверждается по заявлению.
  decisionFactory.registerFallback(generateProtocolFromStatement);

  // Обработчик для FreeDecision (свободное решение)
  decisionFactory.registerHandler('freedecision', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('processDecisions.error.freedecisionMetaMissing'));
      }

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.FreeDecision.Action;

      if (!parsedDocumentMeta.project_id) {
        throw new Error(t('processDecisions.error.projectIdMissing'));
      }

      const { generateFreeDecision } = useGenerateFreeDecision();
      return await generateFreeDecision({
        username,
        decision_id,
        project_id: parsedDocumentMeta.project_id,
      });
    },
  });

  // Обработчик для BranchEstablishmentDecision (решение об учреждении кооперативного участка)
  decisionFactory.registerHandler('branchdec', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('processDecisions.error.branchdecMetaMissing'));
      }

      // в мете заявления (петиции 324) — реквизиты учреждаемого участка
      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.BranchEstablishmentPetition.Action;

      const { generateEstablishmentDecision } = useGenerateEstablishmentDecision();
      return await generateEstablishmentDecision({
        username,
        decision_id,
        branch_name: parsedDocumentMeta.branch_name ?? '',
        address: parsedDocumentMeta.address ?? '',
        // username избранного председателя участка из меты петиции (324); ФИО резолвит фабрика
        chairman: parsedDocumentMeta.chairman ?? '',
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
    // Рядом с заявлением совет видит, что заявитель рассказал о себе в анкетах
    // вступления (сопроводительное письмо и т.п.).
    infoComponent: ParticipantIntakeInfo,
  });

  // Обработчик для AnnualGeneralMeetingSovietDecision (решение совета о годовом собрании)
  decisionFactory.registerHandler('creategm', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('processDecisions.error.creategmMetaMissing'));
      }

      if (!row.table?.hash) {
        throw new Error(t('processDecisions.error.creategmHashMissing'));
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
        throw new Error(t('processDecisions.error.createwthdMetaMissing'));
      }

      const { generateReturnByMoneyDecision } =
        useGenerateReturnByMoneyDecision();

      const parsedDocumentMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.ReturnByMoney.Action;

      if (!parsedDocumentMeta.payment_hash || !parsedDocumentMeta.quantity || !parsedDocumentMeta.currency) {
        throw new Error(t('processDecisions.error.createwthdMetaInvalid'));
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
        throw new Error(t('processDecisions.error.mktwroffMetaMissing'));
      }

      const statementMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.MarketplaceWriteoffStatement.Action;

      if (!statementMeta.proposal_hash || !Array.isArray(statementMeta.items)) {
        throw new Error(t('processDecisions.error.mktwroffMetaInvalid'));
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

  // Обработчик для BranchFinancialAidProtocol (протокол совета о выплате
  // материальной помощи доверенному кооперативного участка).
  // Документ-Решение совета (registry 1112) генерируется из метаданных
  // подписанного Заявления на выплату (1109) + decision_id текущего решения.
  // Получатель берётся из заявления: подписант заявления и есть тот, кому
  // выплачивают. Фабрика сама резолвит его ФИО, состав совета и голоса.
  decisionFactory.registerHandler('brnaid', {
    generateHandler: async ({ decision_id, username, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('processDecisions.error.brnaidMetaMissing'));
      }

      const statementMeta = JSON.parse(
        row.table.statement.meta,
      ) as Cooperative.Registry.BranchFinancialAidStatement.Action;

      if (
        !statementMeta.aid_hash ||
        !statementMeta.braname ||
        !statementMeta.amount ||
        !statementMeta.username
      ) {
        throw new Error(t('processDecisions.error.brnaidMetaInvalid'));
      }

      const { info } = useSystemStore();

      const protocolAction: Cooperative.Registry.BranchFinancialAidProtocol.Action =
        {
          registry_id:
            Cooperative.Registry.BranchFinancialAidProtocol.registry_id,
          coopname: info.coopname,
          username,
          lang: 'ru',
          decision_id,
          aid_hash: statementMeta.aid_hash,
          receiver: statementMeta.username,
          braname: statementMeta.braname,
          amount: statementMeta.amount,
        };

      return await new DigitalDocument().generate(protocolAction, {
        lang: 'ru',
      });
    },
  });

  // Обработчик для DecisionOfParticipantExit (решение о выходе пайщика)
  decisionFactory.registerHandler('leavecoop', {
    generateHandler: async ({ decision_id, username }) => {
      const { generateMembershipExitDecision } =
        useGenerateMembershipExitDecision();
      return await generateMembershipExitDecision({
        username,
        decision_id,
      });
    },
  });
}
