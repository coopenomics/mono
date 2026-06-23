import { ref } from 'vue';
import { Cooperative } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
import { DigitalDocument, type IGeneratedDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates/timezone';
import { api } from '../api';
import type { IKuAgendaPointDraft, KuVote } from './types';

export * from './types';

/**
 * Процессы собрания пайщиков кооперативного участка:
 * шаги с документами — генерация, подпись пайщика и отправка действия;
 * присоединение к собранию — только действие joindec без отдельного документа.
 */
export function useKuDecisionFlow() {
  const system = useSystemStore();
  const session = useSessionStore();
  const kuStore = useKuStore();

  const isSubmitting = ref(false);

  /**
   * Объявить собрание: предложение повестки (320) + createdec.
   * Председатель собрания и адрес/наименование участка определяются позже,
   * на собрании при открытии голосования. Место и время проведения собрания —
   * приватные данные пайщиков: уходят в БД платформы, в подписываемый документ
   * (он публикуется в блокчейне) не входят; braname — служебный аккаунт.
   */
  async function createDecision(input: {
    type: 'createbranch' | 'free';
    braname: string;
    meetPlace: string;
    meetAt: string;
    agenda: IKuAgendaPointDraft[];
  }): Promise<string> {
    isSubmitting.value = true;
    try {
      const hash = await generateUniqueHash();
      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchMeetingProposal.Action>({
        registry_id: Cooperative.Registry.BranchMeetingProposal.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        type: input.type,
        hash,
        questions: input.agenda.map((point, index) => ({
          number: String(index + 1),
          title: point.title,
          context: point.context || undefined,
          decision: point.decision,
        })),
      });

      const proposal = await digitalDocument.sign<Cooperative.Registry.BranchMeetingProposal.Meta>(session.username);

      await api.createDecision({
        coopname: system.info.coopname,
        hash,
        type: input.type === 'createbranch' ? Zeus.KuDecisionType.CREATEBRANCH : Zeus.KuDecisionType.FREE,
        initiator: session.username,
        braname: input.braname,
        agenda: input.agenda,
        proposal,
        meet_place: input.meetPlace,
        meet_at: input.meetAt,
      });

      return hash;
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Присоединиться к собранию: joindec */
  async function joinDecision(decision: IKuDecision): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.joinDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        username: session.username,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Открыть голосование (без документа): организатор назначает председателя
   * из участников собрания и фиксирует адрес/наименование участка, определённые
   * собранием. Окно голосования отмеряет контракт (15 минут).
   */
  async function startDecision(
    decision: IKuDecision,
    input: {
      chairman: string;
      address: string;
      branchName: string;
      branchEmail?: string;
      branchPhone?: string;
      agenda?: IKuAgendaPointDraft[];
    },
  ): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.startDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        chairman: input.chairman,
        address: input.address,
        branch_name: input.branchName,
        branch_email: input.branchEmail ?? '',
        branch_phone: input.branchPhone ?? '',
        agenda: input.agenda ?? [],
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Подать бюллетень: волеизъявление (322) + votedec */
  async function voteOnDecision(decision: IKuDecision, votes: Record<number, KuVote>): Promise<void> {
    isSubmitting.value = true;
    try {
      const questions = decision.questions ?? [];
      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchMeetingBallot.Action>({
        registry_id: Cooperative.Registry.BranchMeetingBallot.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        answers: questions.map((question) => ({
          id: String(question.id),
          number: String(question.number),
          vote: votes[question.id as number] ?? 'abstained',
        })),
        questions: questions.map((question) => ({
          id: String(question.id),
          number: String(question.number),
          title: question.title ?? '',
          context: question.context || undefined,
          decision: question.decision ?? '',
        })),
      });

      const ballot = await digitalDocument.sign<Cooperative.Registry.BranchMeetingBallot.Meta>(session.username);

      await api.voteOnDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        username: session.username,
        ballot,
        votes: questions.map((question) => ({
          question_id: question.id as number,
          vote: votes[question.id as number] ?? 'abstained',
        })),
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Закрыть голосование: протокол (323, одна подпись председателя) + closedec */
  async function closeDecision(decision: IKuDecision): Promise<void> {
    isSubmitting.value = true;
    try {
      const questions = decision.questions ?? [];
      const participantsCount = decision.participants?.length || 0;
      const ballots = decision.signed_ballots || 0;
      const quorumPercent = participantsCount > 0 ? Math.round((ballots / participantsCount) * 100) : 0;

      const formatDateTime = (value?: string | null) =>
        value ? `${formatDateToLocalTimezone(value)} (${getTimezoneLabel()})` : '—';

      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchMeetingDecision.Action>({
        registry_id: Cooperative.Registry.BranchMeetingDecision.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        protocol_number: String(decision.id ?? decision.hash.slice(0, 8)),
        // протокол подписывает председатель собрания — им является организатор;
        // в meta уходит username, ФИО резолвит фабрика
        chairman: decision.initiator ?? session.username,
        open_at_datetime: formatDateTime(decision.open_at),
        close_at_datetime: formatDateTime(decision.close_at),
        current_quorum_percent: quorumPercent,
        questions: questions.map((question) => {
          const votesFor = question.counter_votes_for ?? 0;
          const votesAgainst = question.counter_votes_against ?? 0;
          const votesAbstained = question.counter_votes_abstained ?? 0;
          const total = votesFor + votesAgainst + votesAbstained;
          const percent = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
          return {
            number: String(question.number),
            title: question.title ?? '',
            context: question.context || undefined,
            decision: question.decision ?? '',
            counter_votes_for: String(votesFor),
            counter_votes_against: String(votesAgainst),
            counter_votes_abstained: String(votesAbstained),
            votes_for_percent: percent(votesFor),
            votes_against_percent: percent(votesAgainst),
            votes_abstained_percent: percent(votesAbstained),
            is_accepted: votesFor > votesAgainst,
          };
        }),
      });

      const protocol = await digitalDocument.sign<Cooperative.Registry.BranchMeetingDecision.Meta>(session.username);

      await api.closeDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        protocol,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Сгенерировать (без подписи) пакет документов председателя в совет для предпросмотра:
   * заявление (324), договор о полной материальной ответственности (328) и доверенность
   * председателю участка (329) — с уже подставленными паспортными данными. Пайщик читает
   * их перед подписанием; подпись и отправка — отдельным шагом execDecision.
   */
  async function prepareExecDocuments(decision: IKuDecision): Promise<{
    petition: IGeneratedDocument;
    liability: IGeneratedDocument;
    authority: IGeneratedDocument;
  }> {
    isSubmitting.value = true;
    try {
      const branchName = decision.branch_name ?? '';

      // человекочитаемое наименование участка, служебный braname в документы не попадает
      const petition = await new DigitalDocument().generate<Cooperative.Registry.BranchEstablishmentPetition.Action>({
        registry_id: Cooperative.Registry.BranchEstablishmentPetition.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        branch_name: branchName,
        address: decision.address ?? '',
        // username избранного председателя участка; ФИО резолвит фабрика
        chairman: decision.chairman ?? '',
      });

      const liability = await new DigitalDocument().generate<Cooperative.Registry.BranchTrusteeLiabilityAgreement.Action>({
        registry_id: Cooperative.Registry.BranchTrusteeLiabilityAgreement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        branch_name: branchName,
      });

      const authority = await new DigitalDocument().generate<Cooperative.Registry.BranchTrusteePowerOfAttorney.Action>({
        registry_id: Cooperative.Registry.BranchTrusteePowerOfAttorney.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        branch_name: branchName,
        branch_address: decision.address ?? '',
      });

      return { petition, liability, authority };
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Подписать предпросмотренный пакет и направить в совет (exec): заявление (324),
   * договор матответственности (328) и доверенность (329) — все подписывает избранный
   * собранием председатель участка. Договор и доверенность получат встречную подпись
   * председателя совета после решения совета об учреждении участка.
   */
  async function execDecision(
    decision: IKuDecision,
    prepared: { petition: IGeneratedDocument; liability: IGeneratedDocument; authority: IGeneratedDocument },
  ): Promise<void> {
    isSubmitting.value = true;
    try {
      const petition = await new DigitalDocument(prepared.petition).sign<
        Cooperative.Registry.BranchEstablishmentPetition.Meta
      >(session.username);
      const liability = await new DigitalDocument(prepared.liability).sign<
        Cooperative.Registry.BranchTrusteeLiabilityAgreement.Meta
      >(session.username);
      const authority = await new DigitalDocument(prepared.authority).sign<
        Cooperative.Registry.BranchTrusteePowerOfAttorney.Meta
      >(session.username);

      await api.execDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        petition,
        liability,
        authority,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Отменить собрание (без документа, причина в аргументе) */
  async function cancelDecision(decision: IKuDecision, reason: string): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.cancelDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        reason,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Обновить решение в сторе после действия */
  async function reload(hash: string): Promise<void> {
    await kuStore.loadDecision(hash);
  }

  return {
    isSubmitting,
    createDecision,
    joinDecision,
    startDecision,
    voteOnDecision,
    closeDecision,
    prepareExecDocuments,
    execDecision,
    cancelDecision,
    reload,
  };
}
