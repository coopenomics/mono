import { ref, type Ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { useBranchStore, type IBranch } from 'src/entities/Branch/model';
import { generateUsername } from 'src/shared/lib/utils/generateUsername';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';

export type ICreateBranchInput = Mutations.Branches.CreateBranch.IInput['data']

export function useCreateBranch() {
  const store = useBranchStore();
  const { info } = useSystemStore()

  const initialCreateBranchInput: ICreateBranchInput = {
    coopname: info.coopname,
    braname: '',
    email: '',
    fact_address: '',
    short_name: '',
    full_name: '',
    phone: '',
    based_on: '',
    trustee: ''
  };

  const createBranchInput = ref<ICreateBranchInput>({
    ...initialCreateBranchInput,
    braname: generateUsername() // Генерация начального имени
  });

  // Универсальная функция для сброса объекта к начальному состоянию
  function resetInput(input: Ref<ICreateBranchInput>, initial: ICreateBranchInput) {
    Object.assign(input.value, initial);
    input.value.braname = generateUsername()
  }

  async function createBranch(data: ICreateBranchInput): Promise<IBranch> {
    data.full_name = t('branch.createBranchModel.fullNameTemplate', { shortName: data.short_name })
    const branch = await api.createBranch(data);

    await store.loadBranches({ coopname: info.coopname });

    // Сбрасываем createBranchInput после выполнения createBranch
    resetInput(createBranchInput, initialCreateBranchInput);

    return branch;
  }

  return { createBranch, createBranchInput };
}
