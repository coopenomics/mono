import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useContributorStore,
  type IRegisterContributorOutput,
} from 'app/extensions/capital/entities/Contributor/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { t } from '../../../../i18n';

export type IRegisterContributorInput =
  Mutations.Capital.RegisterContributor.IInput['data'];

export type IGenerateGenerationContractInput =
  Mutations.Capital.GenerateGenerationContract.IInput['data'];

export function useRegisterContributor() {
  const store = useContributorStore();
  const system = useSystemStore();
  const session = useSessionStore();

  // Состояния для генерации документов
  const isGenerating = ref(false);
  const generatedDocument = ref<IGeneratedDocumentOutput | null>(null);
  const generationError = ref(false);
  const contributorHash = ref<string>('');

  const registerContributorInput = ref<IRegisterContributorInput>({} as IRegisterContributorInput);

  async function registerContributor(
    data: IRegisterContributorInput,
  ): Promise<IRegisterContributorOutput> {
    const transaction = await api.registerContributor(data);

    // Обновляем информацию о текущем пользователе
    await store.loadSelf({
      username: session.username,
    });

    return transaction;
  }

  // Генерация документа участия
  async function generateDocument(): Promise<IGeneratedDocumentOutput | null> {
    try {
      generationError.value = false;
      generatedDocument.value = null;

      // Генерируем contributor_hash, если он еще не сгенерирован
      if (!contributorHash.value) {
        contributorHash.value = await generateUniqueHash();
      }

      const data: IGenerateGenerationContractInput = {
        coopname: system.info.coopname,
        username: session.username,
        contributor_hash: contributorHash.value,
      };
      console.log('🔐 Генерируем данные для генерации договора:', data);
      generatedDocument.value = await api.generateGenerationContract(data);
      return generatedDocument.value;
    } catch (error) {
      console.error('Ошибка при генерации договора:', error);
      generationError.value = true;
      throw error;
    }
  }

  // Повторная генерация документа
  const regenerateDocument = async (): Promise<IGeneratedDocumentOutput | null> => {
    isGenerating.value = true;
    try {
      return await generateDocument();
    } finally {
      isGenerating.value = false;
    }
  };

  // Подпись документа с последующей регистрацией
  async function registerContributorWithGeneratedDocument(
    document: any,
    about?: string,
    hoursPerDay?: number,
    ratePerHour?: string
  ): Promise<IRegisterContributorOutput> {
    isGenerating.value = true;
    try {
      if (!document) {
        throw new Error(t('capital.error.registerContributorDocumentMissing'));
      }

      // Подписываем документ
      const digitalDocument = new DigitalDocument(document);
      const signedDoc = await digitalDocument.sign(session.username);

      // Заполняем данные для регистрации
      registerContributorInput.value.coopname = system.info.coopname;
      registerContributorInput.value.username = session.username;
      registerContributorInput.value.contributor_hash = contributorHash.value;
      registerContributorInput.value.about = about || '';
      registerContributorInput.value.hours_per_day = hoursPerDay;
      registerContributorInput.value.rate_per_hour = ratePerHour;
      registerContributorInput.value.contract = signedDoc;

      // Регистрируем участника
      return await registerContributor(registerContributorInput.value);
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    registerContributor,
    registerContributorInput,
    // Новые функции для работы с документами
    generateDocument,
    regenerateDocument,
    registerContributorWithGeneratedDocument,
    // Состояния генерации
    isGenerating,
    generatedDocument,
    generationError,
    // Экспортируем contributorHash для использования в других компонентах
    contributorHash,
  };
}
