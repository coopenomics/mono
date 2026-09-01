import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { api, type IVerificationPhotoInput } from '../api';

/**
 * Управление верификацией личности пайщика. Участок передаёт оператор
 * кооперативного участка — тогда сверка записывается за участком; совет
 * кооператива участок не передаёт, и в записи стоит он.
 */
export function useVerifyIdentity() {
  const loading = ref(false);

  const verify = async (
    username: string,
    braname?: string,
    photos?: IVerificationPhotoInput[],
  ): Promise<boolean> => {
    try {
      loading.value = true;
      await api.verifyParticipant({
        username,
        ...(braname ? { braname } : {}),
        ...(photos?.length ? { photos } : {}),
      });
      SuccessAlert(
        braname
          ? 'Личность подтверждена. Сверку проверит совет кооператива'
          : 'Личность пайщика подтверждена',
      );
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
