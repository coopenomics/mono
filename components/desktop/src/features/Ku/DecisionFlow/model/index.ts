import { ref } from 'vue';
import { Cooperative } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
import { DigitalDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { api } from '../api';
import type { IKuAgendaPointDraft, KuVote } from './types';

export * from './types';

/**
 * Процессы собрания пайщиков кооперативного участка:
 * каждый шаг — генерация документа, подпись пайщика и отправка действия.
 */
export function useKuDecisionFlow() {
  const system = useSystemStore();
  const session = useSessionStore();
  const kuStore = useKuStore();

  const isSubmitting = ref(false);

  /** Объявить собрание: предложение повестки (320) + createdec */
  async function createDecision(input: {
    type: 'createbranch' | 'free';
    braname: string;
    address: string;
    chairmanCandidate: string;
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
        braname: input.braname || undefined,
        address: input.address || undefined,
        chairman_candidate: input.chairmanCandidate || undefined,
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
      });

      return hash;
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Присоединиться к собранию: заявление (321) + joindec */
  async function joinDecision(decision: IKuDecision): Promise<void> {
    isSubmitting.value = true;
    try {
      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchMeetingJoinStatement.Action>({
        registry_id: Cooperative.Registry.BranchMeetingJoinStatement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
      });

      const statement = await digitalDocument.sign<Cooperative.Registry.BranchMeetingJoinStatement.Meta>(
        session.username,
      );

      await api.joinDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        username: session.username,
        statement,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Назначить председателя собрания (без документа) */
  async function setChairman(decision: IKuDecision, chairman: string): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.setDecisionChairman({
        coopname: system.info.coopname,
        hash: decision.hash,
        chairman,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Открыть голосование (без документа) */
  async function startDecision(decision: IKuDecision, input: { address: string; openAt: string; closeAt: string }): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.startDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        address: input.address,
        open_at: input.openAt,
        close_at: input.closeAt,
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

      const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('ru-RU') : '—');

      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchMeetingDecision.Action>({
        registry_id: Cooperative.Registry.BranchMeetingDecision.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        protocol_number: String(decision.id ?? decision.hash.slice(0, 8)),
        chairman_full_name: decision.chairman ?? session.username,
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

  /** Направить заявление в совет: заявление председателя (324) + exec */
  async function execDecision(decision: IKuDecision): Promise<void> {
    isSubmitting.value = true;
    try {
      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchEstablishmentPetition.Action>({
        registry_id: Cooperative.Registry.BranchEstablishmentPetition.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash: decision.hash,
        braname: decision.braname ?? '',
        address: decision.address ?? '',
      });

      const petition = await digitalDocument.sign<Cooperative.Registry.BranchEstablishmentPetition.Meta>(
        session.username,
      );

      await api.execDecision({
        coopname: system.info.coopname,
        hash: decision.hash,
        petition,
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
    setChairman,
    startDecision,
    voteOnDecision,
    closeDecision,
    execDecision,
    cancelDecision,
    reload,
  };
}
