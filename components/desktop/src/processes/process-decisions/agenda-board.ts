import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { SovietContract } from 'cooptypes';
import { useAgendaStore } from 'src/entities/Agenda/model';
import type { IAgenda } from 'src/entities/Agenda/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { t } from 'src/shared/i18n';
import { useDecisionProcessor } from 'src/processes/process-decisions';

/**
 * Работа с повесткой совета на экране: вопросы, их живое обновление и действия
 * члена совета и председателя с отметкой «идёт обработка» по вопросу. Одна
 * логика у списка повестки и у отдельной страницы вопроса.
 */
export function useAgendaBoard() {
  const route = useRoute();
  const processor = useDecisionProcessor();
  const agendaStore = useAgendaStore();
  const coopname = () => route.params.coopname as string;

  const decisions = computed(() => processor.decisions.value);
  const processingDecisions = ref<Record<number, boolean>>({});

  // Состояние обработки проставляется заменой объекта: так его видит реактивность.
  const setProcessing = (decision_id: number, value: boolean) => {
    processingDecisions.value = { ...processingDecisions.value, [decision_id]: value };
  };
  const isProcessing = (decision_id: number | string) => Boolean(processingDecisions.value[Number(decision_id)]);

  // Дозагрузка повестки после действия. Наложение запросов и ошибку гасит
  // store.refresh: ту же дозагрузку делает кнопка «Обновить» в шапке. Ошибка
  // обновления пайщику не показывается: список — фоновая вещь, и его сбой не
  // означает, что голос не прошёл.
  const refreshAgendaQuietly = () => agendaStore.refresh({ coopname: coopname() });

  // Живая повестка: голос члена совета, новый вопрос, утверждение или отклонение
  // меняют soviet::decisions, смена состава совета — soviet::boards.
  const live = useLiveReload(
    [liveTable(SovietContract, SovietContract.Tables.Decisions), liveTable(SovietContract, SovietContract.Tables.Boards)],
    refreshAgendaQuietly,
  );

  /** Действие по вопросу с отметкой обработки: ошибка показывается, успех перечитывает повестку. */
  async function act(row: IAgenda, action: (row: IAgenda) => Promise<unknown>, successText: string): Promise<boolean> {
    const decision_id = Number(row.table.id);
    setProcessing(decision_id, true);
    try {
      await action(row);
    } catch (e) {
      FailAlert(e);
      setProcessing(decision_id, false);
      return false;
    }
    SuccessAlert(successText);
    // Ответ мутации приходит, когда узел разобрал её блок: перечитанная повестка уже изменена.
    await live.refresh();
    setProcessing(decision_id, false);
    return true;
  }

  const onAuthorizeDecision = (row: IAgenda) => act(row, processor.authorizeAndExecuteDecision, t('cooperative.listOfAgendaQuestions.approvedSuccess'));
  // Отклонённое решение контракт стирает — повестка перечитывается без него.
  const onDeclineDecision = (row: IAgenda) => act(row, processor.declineDecision, t('cooperative.listOfAgendaQuestions.rejectedSuccess'));
  // Голос вопрос из повестки не убирает: он остаётся с отметкой голоса.
  const onVoteFor = (row: IAgenda) => act(row, processor.voteForDecision, t('cooperative.listOfAgendaQuestions.voteAcceptedSuccess'));
  const onVoteAgainst = (row: IAgenda) => act(row, processor.voteAgainstDecision, t('cooperative.listOfAgendaQuestions.voteAcceptedSuccess'));

  /** Первая загрузка повестки экрана; сбой показывается сообщением. */
  const load = () => processor.loadDecisions(coopname()).catch(FailAlert);

  return {
    decisions,
    loading: processor.loading,
    processingDecisions,
    isProcessing,
    isVotedFor: processor.isVotedFor,
    isVotedAgainst: processor.isVotedAgainst,
    isVotedAny: processor.isVotedAny,
    formatDecisionTitle: processor.formatDecisionTitle,
    onAuthorizeDecision,
    onDeclineDecision,
    onVoteFor,
    onVoteAgainst,
    load,
  };
}
