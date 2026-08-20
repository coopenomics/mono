import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { api } from '../api';

/**
 * Управление верификацией личности пайщика из реестра совета: председатель
 * подтверждает личность по паспорту и может отозвать подтверждение. Участок
 * не передаётся — сверку проводит совет кооператива, и именно это фиксируется
 * в записи верификации.
 */
export function useVerifyIdentity() {
  const loading = ref(false);

  const verify = async (username: string): Promise<boolean> => {
    try {
      loading.value = true;
      await api.verifyParticipant({ username });
      SuccessAlert('Личность пайщика подтверждена');
      return true;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      loading.value = false;
    }
  };

  const unverify = async (username: string): Promise<boolean> => {
    try {
      loading.value = true;
      await api.unverifyParticipant({ username });
      SuccessAlert('Верификация личности отозвана');
      return true;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      loading.value = false;
    }
  };

  return { verify, unverify, loading };
}
