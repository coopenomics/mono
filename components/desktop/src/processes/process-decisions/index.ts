import { Cooperative, SovietContract } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api as authorizeDecisionApi } from 'src/features/Decision/AuthorizeAndExecDecision/api';
import { api as declineDecisionApi } from 'src/features/Decision/DeclineDecision';
import { useVoteForDecision } from 'src/features/Decision/VoteForDecision';
import { useVoteAgainstDecision } from 'src/features/Decision/VoteAgainstDecision';
import { computed } from 'vue';
import { useAgendaStore } from 'src/entities/Agenda/model';
import type { IAgenda } from 'src/entities/Agenda/model';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IUserCertificateUnion } from 'src/shared/lib/types/certificate';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { registerBaseDecisionHandlers } from './handlers';
import { t } from 'src/shared/i18n';

/**
 * Процесс обработки решений
 * Координирует работу различных фич для генерации и обработки решений различных типов
 */
export function useDecisionProcessor() {
  // Регистрируем базовые обработчики решений при первом использовании
  registerBaseDecisionHandlers();

  const { info } = useSystemStore();
  const session = useSessionStore();
  const agendaStore = useAgendaStore();

  // Данные повестки и состояние загрузки
  const decisions = computed(() => agendaStore.agenda);
  const loading = computed(() => agendaStore.loading);

  /**
   * Форматирует заголовок вопроса
   */
  function formatDecisionTitle(title: string, cert?: IUserCertificateUnion) {
    const baseTitle = title || t('processDecisions.processDecisions.voteTitle');
    const name = getNameFromCertificate(cert);

    if (name) {
      return t('processDecisions.processDecisions.titleWithAuthor', { baseTitle, name });
    }

    return baseTitle;
  }

  /**
   * Получает заголовок документа из агрегата
   */
  function getDocumentTitle(row: IAgenda) {
    // Используем только агрегаты документов
    const rawStatement = row.documents?.statement?.documentAggregate?.rawDocument;
    const statementMeta = rawStatement?.meta as Cooperative.Document.IMetaDocument | undefined;

    if (rawStatement?.full_title) {
      return rawStatement.full_title;
    }

    if (statementMeta?.title) {
      return statementMeta.title;
    }

    if (row.documents?.decision?.documentAggregate?.rawDocument?.full_title) {
      return row.documents.decision.documentAggregate.rawDocument.full_title;
    }

    // Поддержка исходного формата для таблицы
    if (
      row.table?.statement?.meta &&
      typeof row.table.statement.meta === 'object' &&
      (row.table.statement.meta as any).title
    ) {
      return (row.table.statement.meta as any).title;
    }

    if (
      row.table?.statement?.meta &&
      typeof row.table.statement.meta === 'string'
    ) {
      try {
        const meta = JSON.parse(row.table.statement.meta);
        if (meta.title) return meta.title;
      } catch {
        // Игнорируем ошибку парсинга JSON
      }
    }

    return t('processDecisions.processDecisions.untitledQuestion');
  }

  /**
   * Загружает список вопросов на повестке
   */
  async function loadDecisions(coopname: string, hidden = false) {
    try {
      const result = await agendaStore.loadAgenda({ coopname }, hidden);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Получает хеш документа из агрегата
   */
  function getDocumentHash(row: IAgenda) {
    // Используем только агрегаты документов
    if (row.documents?.statement?.documentAggregate?.rawDocument?.hash) {
      return row.documents.statement.documentAggregate.rawDocument.hash;
    }

    if (row.documents?.decision?.documentAggregate?.rawDocument?.hash) {
      return row.documents.decision.documentAggregate.rawDocument.hash;
    }

    // Поддержка исходного формата для таблицы
    if (row.table?.statement?.hash) {
      return row.table.statement.hash;
    }

    return null;
  }

  /**
   * Генерирует документ решения в зависимости от его типа
   */
  async function generateDecisionDocument(row: IAgenda) {
    if (!row.table) {
      throw new Error(t('decision.error.tableMissing'));
    }

    if (!row.table.id || !row.table.username || !row.table.type) {
      throw new Error(t('decision.error.dataInvalid'));
    }

    const decision_id = Number(row.table.id);
    if (isNaN(decision_id)) {
      throw new Error(t('decision.error.idInvalid'));
    }

    const username = row.table.username;
    const type = row.table.type;

    // Используем фабрику для генерации документа решения
    const document = await decisionFactory.generateDocument(type, {
      decision_id,
      username,
      row,
    });

    if (!document) {
      throw new Error(t('decision.error.generateError'));
    }

    return document;
  }

  /**
   * Авторизует и выполняет решение
   */
  async function authorizeAndExecuteDecision(row: IAgenda) {
    if (!row.table) {
      throw new Error(t('decision.error.tableMissing'));
    }

    if (!row.table.id) {
      throw new Error(t('decision.error.idMissing'));
    }

    const decision_id = Number(row.table.id);
    if (isNaN(decision_id)) {
      throw new Error(t('decision.error.idInvalid'));
    }

    // Генерируем документ решения
    const document = await generateDecisionDocument(row);

    // Создаем экземпляр класса DigitalDocument и подписываем документ
    const digitalDocument = new DigitalDocument(document);
    const signedDocument = await digitalDocument.sign(session.username);

    // Утверждение + исполнение проводит контроллер ключом кооператива
    // (мутация authorizeDecision). meta передаём объектом — бэкенд сам
    // сериализует при сборке chain-action; подпись председателя на документе
    // сохраняется и проверяется контрактом.
    await authorizeDecisionApi.authorizeDecision({
      coopname: info.coopname,
      chairman: session.username,
      decision_id,
      document: signedDocument,
    });

    return true;
  }

  /**
   * Отклоняет решение, против которого проголосовало большинство совета
   * (отрицательный консенсус). Проводит контроллер ключом кооператива; контракт
   * проверяет порог «против». Развязано с авто-отменой по сроку (cancelexprd).
   */
  async function declineDecision(row: IAgenda) {
    if (!row.table) {
      throw new Error(t('decision.error.tableMissing'));
    }

    if (!row.table.id) {
      throw new Error(t('decision.error.idMissing'));
    }

    const decision_id = Number(row.table.id);
    if (isNaN(decision_id)) {
      throw new Error(t('decision.error.idInvalid'));
    }

    await declineDecisionApi.declineDecision({
      coopname: info.coopname,
      decision_id,
    });

    return true;
  }

  /**
   * Голосовать "за" решение
   */
  async function voteForDecision(row: IAgenda) {
    if (!row.table) {
      throw new Error(t('decision.error.tableMissing'));
    }

    if (!row.table.id) {
      throw new Error(t('decision.error.idFetchFailed'));
    }

    const decision_id = Number(row.table.id);
    if (isNaN(decision_id)) {
      throw new Error(t('decision.error.idInvalid'));
    }

    const { voteForDecision: vote } = useVoteForDecision();
    await vote(decision_id);
    return true;
  }

  /**
   * Голосовать "против" решения
   */
  async function voteAgainstDecision(row: IAgenda) {
    if (!row.table) {
      throw new Error(t('decision.error.tableMissing'));
    }

    if (!row.table.id) {
      throw new Error(t('decision.error.idFetchFailed'));
    }

    const decision_id = Number(row.table.id);
    if (isNaN(decision_id)) {
      throw new Error(t('decision.error.idInvalid'));
    }

    const { voteAgainstDecision } = useVoteAgainstDecision();
    await voteAgainstDecision(decision_id);
    return true;
  }

  /**
   * Проверяет, проголосовал ли текущий пользователь "за" решение
   */
  function isVotedFor(decision: SovietContract.Tables.Decisions.IDecision) {
    return decision.votes_for.includes(session.username);
  }

  /**
   * Проверяет, проголосовал ли текущий пользователь "против" решения
   */
  function isVotedAgainst(decision: SovietContract.Tables.Decisions.IDecision) {
    return decision.votes_against.includes(session.username);
  }

  /**
   * Проверяет, проголосовал ли текущий пользователь за решение каким-либо образом
   */
  function isVotedAny(decision: SovietContract.Tables.Decisions.IDecision) {
    return isVotedAgainst(decision) || isVotedFor(decision);
  }

  /**
   * Получает компонент дополнительной информации для типа решения
   * @param decisionType - тип решения
   * @returns компонент или undefined если не задан
   */
  function getDecisionInfoComponent(decisionType: string) {
    return decisionFactory.getInfoComponent(decisionType);
  }

  return {
    decisions,
    loading,
    loadDecisions,
    generateDecisionDocument,
    authorizeAndExecuteDecision,
    declineDecision,
    voteForDecision,
    voteAgainstDecision,
    isVotedFor,
    isVotedAgainst,
    isVotedAny,
    formatDecisionTitle,
    getDocumentTitle,
    getDocumentHash,
    getDecisionInfoComponent,
  };
}
