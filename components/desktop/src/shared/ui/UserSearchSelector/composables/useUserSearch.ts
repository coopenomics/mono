import { ref } from 'vue';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { UserSearchResult } from '../model/types';
import { t } from 'src/shared/i18n';

/**
 * Композабл для поиска пользователей
 */
export function useUserSearch() {
  const searchResults = ref<UserSearchResult[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Выполняет поиск пользователей по запросу
   * @param query Поисковый запрос
   */
  const searchUsers = async (query: string): Promise<void> => {
    if (!query || query.length < 1) {
      searchResults.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      console.log('Making API call with query:', query); // Отладка

      const response = await client.Query(
        Queries.Accounts.SearchPrivateAccounts.query,
        {
          variables: {
            data: {
              query: query.trim(),
            },
          },
        },
      );

      console.log('API response:', response); // Отладка

      searchResults.value = response.searchPrivateAccounts || [];
      console.log('Updated searchResults:', searchResults.value); // Отладка
    } catch (err) {
      console.error('Ошибка поиска пользователей:', err);
      error.value = t('ui.useUserSearch.searchError');
      searchResults.value = [];
      throw err; // Пробрасываем ошибку для обработки в компоненте
    } finally {
      loading.value = false;
    }
  };

  /**
   * Очищает результаты поиска
   */
  const clearResults = () => {
    searchResults.value = [];
    error.value = null;
  };

  return {
    searchResults,
    loading,
    error,
    searchUsers,
    clearResults,
  };
}
