import { ref } from 'vue';
import { api } from '../api';
import {
  useContributorStore,
} from 'app/extensions/capital/entities/Contributor/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { CapitalProgramAgreementType } from 'app/extensions/capital/shared/lib';
import { useSendAgreement, type ISendAgreementInput } from 'src/shared/composables/agreements';
import { useWalletStore } from 'src/entities/Wallet';
import { t } from '../../../../i18n';


export function useSignCapitalProgramAgreement() {
  const store = useContributorStore();
  const system = useSystemStore();
  const session = useSessionStore();
  const { sendAgreement } = useSendAgreement();
  const walletStore = useWalletStore();
  // Состояния для генерации документов
  const isGenerating = ref(false);
  const generatedDocument = ref<IGeneratedDocumentOutput | null>(null);
  const generationError = ref(false);

  // Состояния для подписания
  const isSigning = ref(false);

  // Генерация соглашения о целевой потребительской программе
  async function generateAgreement(): Promise<IGeneratedDocumentOutput | null> {
    try {
      generationError.value = false;
      generatedDocument.value = null;

      const data = {
        coopname: system.info.coopname,
        username: session.username,
        lang: 'ru',
      };

      generatedDocument.value = await api.generateCapitalizationAgreement(data);
      return generatedDocument.value;
    } catch (error) {
      console.error('Ошибка при генерации соглашения:', error);
      generationError.value = true;
      throw error;
    }
  }

  // Повторная генерация соглашения
  const regenerateAgreement = async (): Promise<IGeneratedDocumentOutput | null> => {
    isGenerating.value = true;
    try {
      return await generateAgreement();
    } finally {
      isGenerating.value = false;
    }
  };

  // Подписание и отправка соглашения с уже сгенерированным документом
  async function signAndSendAgreementWithGeneratedDocument(document: any): Promise<void> {
    isSigning.value = true;
    try {
      if (!document) {
        throw new Error(t('capital.error.agreementDocumentMissing'));
      }

      console.log('🔐 Подписываем документ в модели, hash:', document.hash);

      // Подписываем документ одинарной подписью
      const digitalDocument = new DigitalDocument(document);
      const signedDoc = await digitalDocument.sign(session.username);

      // Готовим данные для отправки через GraphQL мутацию
      const sendAgreementData: ISendAgreementInput = {
        coopname: system.info.coopname,
        administrator: system.info.coopname, // администратор - это кооператив
        username: session.username,
        agreement_type: CapitalProgramAgreementType,
        document: signedDoc // Приведение типов, так как структуры совместимы
      };

      // Отправляем соглашение через GraphQL мутацию
      await sendAgreement(sendAgreementData);

      // Обновляем self в сторе участников после подписания
      await store.loadSelf({
        username: session.username,
      });

      await walletStore.loadUserWallet({
        coopname: system.info.coopname,
        username: session.username,
      });

    } finally {
      isSigning.value = false;
    }
  }

  // Подписание и отправка соглашения (устаревшая функция для обратной совместимости)
  async function signAndSendAgreement(): Promise<void> {
    isSigning.value = true;
    try {
      // Генерируем документ
      const document = await generateAgreement();
      if (!document) {
        throw new Error(t('capital.error.agreementGenerateFailed'));
      }

      // Используем новую функцию
      await signAndSendAgreementWithGeneratedDocument(document);

    } finally {
      isSigning.value = false;
    }
  }

  return {
    generateAgreement,
    regenerateAgreement,
    signAndSendAgreement,
    signAndSendAgreementWithGeneratedDocument,
    // Состояния генерации
    isGenerating,
    generatedDocument,
    generationError,
    // Состояния подписания
    isSigning,
  };
}
