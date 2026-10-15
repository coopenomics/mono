import { ref } from 'vue';
import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { t } from '../../../../../i18n';

export function useCreateMatrixAccount() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const createAccount = async (username: string, password: string): Promise<boolean> => {
    isLoading.value = true;
    error.value = null;

    try {
      const { [Mutations.ChatCoop.CreateAccount.name]: result } = await client.Mutation(
        Mutations.ChatCoop.CreateAccount.mutation,
        {
          variables: {
          data: { username, password },
          },
        }
      );

      return result;
    } catch (err: any) {
      console.error('Failed to create Matrix account:', err);
      error.value = err?.message || t('chatcoop.createMatrixAccount.createError');
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    createAccount,
    isLoading,
    error,
  };
}
