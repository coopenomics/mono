import { ref, type Ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { type ICreateCommitOutput } from 'app/extensions/capital/entities/Commit/model';
import { useTimeStatsStore } from 'app/extensions/capital/entities/TimeStats/model';
import { useTimeIssuesStore } from 'app/extensions/capital/entities/TimeIssues/model';
import { useSystemStore } from 'src/entities/System/model';

export type ICreateCommitInput = Mutations.Capital.CreateCommit.IInput['data'];

export function useCreateCommit(projectHash?: string, username?: string) {
  const timeStatsStore = useTimeStatsStore();
  const timeIssuesStore = useTimeIssuesStore();
  const { info } = useSystemStore();

  const initialCreateCommitInput: ICreateCommitInput = {
    coopname: '',
    commit_hours: 0,
    description: '',
    meta: '',
    project_hash: projectHash || '',
    username: username || '',
    data: undefined, // Опционально - JSON строка с типизированным контентом
  };

  const createCommitInput = ref<ICreateCommitInput>({
    ...initialCreateCommitInput,
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(
    input: Ref<ICreateCommitInput>,
    initial: ICreateCommitInput,
  ) {
    Object.assign(input.value, initial);
  }

  async function createCommit(
    data: ICreateCommitInput,
  ): Promise<ICreateCommitOutput> {
    const transaction = await api.createCommit(data);

    const coopname = data.coopname || info.coopname;

    // Обновляем статистику компонента и список задач — иначе строки задач остаются со старыми часами
    await Promise.all([
      timeStatsStore.loadTimeStat({
        username: data.username,
        project_hash: data.project_hash,
        coopname,
      }),
      timeIssuesStore.loadTimeIssues({
        filter: {
          coopname,
          project_hash: data.project_hash,
          username: data.username,
        },
        options: {
          page: 1,
          limit: 50,
          sortBy: 'total_hours',
          sortOrder: 'DESC',
        },
      }),
    ]);

    // Сбрасываем createCommitInput после выполнения createCommit
    resetInput(createCommitInput, initialCreateCommitInput);

    return transaction;
  }

  return { createCommit, createCommitInput };
}
