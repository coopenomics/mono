import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useInvestStore,
  type ICreateProjectInvestOutput,
} from 'app/extensions/capital/entities/Invest/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { useProjectStore } from '../../../../entities/Project/model/store';
import { useWalletStore } from 'src/entities/Wallet';
import { t } from '../../../../i18n';

export type ICreateProjectInvestInput =
  Mutations.Capital.CreateProjectInvest.IInput['data'];

export function useCreateProjectInvest() {
  const store = useInvestStore();
  const system = useSystemStore();
  const session = useSessionStore();
  const projectStore = useProjectStore();
  const walletStore = useWalletStore();

  // Состояния для генерации документов
  const isGenerating = ref(false);
  const generatedDocument = ref<IGeneratedDocumentOutput | null>(null);
  const generationError = ref(false);

  async function createProjectInvest(
    data: ICreateProjectInvestInput,
  ): Promise<ICreateProjectInvestOutput> {
    const transaction = await api.createProjectInvest(data);

    // Обновляем список инвестиций после создания
    await store.loadInvests({});

    return transaction;
  }

  // Генерация заявления на инвестицию
  async function generateInvestStatement(projectHash: string, amount: string): Promise<IGeneratedDocumentOutput | null> {
    try {
      isGenerating.value = true;
      generationError.value = false;
      generatedDocument.value = null;

      const data = {
        coopname: system.info.coopname,
        username: session.username,
        project_hash: projectHash,
        amount: parseFloat(amount).toFixed(system.info.symbols.root_govern_precision) + ' ' + system.info.symbols.root_govern_symbol,
      };

      generatedDocument.value = await api.generateGenerationMoneyInvestStatement(data);
      return generatedDocument.value;
    } catch (error) {
      console.error('Ошибка при генерации заявления на инвестицию:', error);
      generationError.value = true;
      throw error;
    } finally {
      isGenerating.value = false;
    }
  }


  // Создание инвестиции с сгенерированным и подписанным заявлением
  async function createProjectInvestWithGeneratedStatement(
    amount: string,
    projectHash: string,
  ): Promise<ICreateProjectInvestOutput> {
    try {
      isGenerating.value = true;

      // Генерируем заявление
      const document = await generateInvestStatement(projectHash, amount);
      if (!document) {
        throw new Error(t('capital.error.investGenerateFailed'));
      }

      // Подписываем документ
      const digitalDocument = new DigitalDocument(document);
      const signedDoc = await digitalDocument.sign(session.username);

      // Создаем объект инвестиции
      const investData: ICreateProjectInvestInput = {
        coopname: system.info.coopname,
        username: session.username,
        project_hash: projectHash,
        amount: parseFloat(amount).toFixed(system.info.symbols.root_govern_precision) + ' ' + system.info.symbols.root_govern_symbol,
        statement: signedDoc,
      };

      // Создаем инвестицию
      const result = await createProjectInvest(investData);

      // Обновляем состояние проекта в store
      await projectStore.loadProject({ hash: projectHash });

      // Перезагружаем кошелек в walletStore
      await walletStore.loadUserWallet({
        coopname: system.info.coopname,
        username: session.username,
      });

      return result;
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    createProjectInvest,
    // Новые функции для работы с заявлениями
    generateInvestStatement,
    createProjectInvestWithGeneratedStatement,
    // Состояния генерации
    isGenerating,
    generationError,
  };
}
