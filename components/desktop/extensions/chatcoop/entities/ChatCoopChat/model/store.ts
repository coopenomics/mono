import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { IChatCoopAccountStatus } from './types';
import { t } from '../../../i18n';

const namespace = 'chatcoopChatStore';

interface IChatCoopChatStore {
  accountStatus: Ref<IChatCoopAccountStatus | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  loadAccountStatus: () => Promise<IChatCoopAccountStatus | null>;
  clearAccountStatus: () => void;
  clearError: () => void;
}

export const useChatCoopChatStore = defineStore(
  namespace,
  (): IChatCoopChatStore => {
    const accountStatus = ref<IChatCoopAccountStatus | null>(null);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    const loadAccountStatus = async (): Promise<IChatCoopAccountStatus | null> => {
      // Лоадер и ошибка — только до первого ответа. Дочитка по ленте и по
      // возврату вкладки идёт при уже открытом чате: экран ветвится по
      // isLoading/error через v-if, и каждое их переключение снимало iframe
      // Matrix-клиента и вставляло заново — клиент загружался с нуля при
      // каждом возврате фокуса на вкладку.
      const firstLoad = accountStatus.value === null;
      if (firstLoad) isLoading.value = true;
      error.value = null;

      try {
        const status = await api.getAccountStatus();
        accountStatus.value = status;
        return status;
      } catch (err) {
        console.error('Failed to load ChatCoop account status:', err);
        if (firstLoad) error.value = t('chatcoop.chatStore.statusError');
        return accountStatus.value;
      } finally {
        isLoading.value = false;
      }
    };

    const clearAccountStatus = () => {
      accountStatus.value = null;
    };

    const clearError = () => {
      error.value = null;
    };

    return {
      accountStatus,
      isLoading,
      error,
      loadAccountStatus,
      clearAccountStatus,
      clearError,
    };
  },
);
