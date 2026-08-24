import { ref } from 'vue';
import { readFileForUpload } from 'src/shared/lib/utils/readFileForUpload';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { api, type ICooperativeCharter } from '../api';

/**
 * Устав кооператива в заявке на подключение: загрузка и чтение уже приложенного.
 *
 * Файл отправляется сразу при выборе — так пайщик видит результат до перехода
 * к следующему шагу, а мастер не хранит бинарь в состоянии.
 */
export function useCooperativeCharter() {
  const charter = ref<ICooperativeCharter | null>(null);
  const uploading = ref(false);
  const loading = ref(false);
  const error = ref<string>('');

  const scope = () => {
    const session = useSessionStore();
    const system = useSystemStore();
    return { coopname: system.info.coopname, username: session.username };
  };

  async function load(): Promise<void> {
    const { coopname, username } = scope();
    if (!coopname || !username) return;
    loading.value = true;
    try {
      charter.value = await api.loadCooperativeCharter(coopname, username);
    } catch {
      // Отсутствие устава — обычное состояние в начале заявки, не ошибка экрана.
      charter.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function upload(file: File): Promise<boolean> {
    const { coopname, username } = scope();
    error.value = '';
    uploading.value = true;
    try {
      const payload = await readFileForUpload(file);
      charter.value = await api.uploadCooperativeCharter({ coopname, username, ...payload });
      return true;
    } catch (e: any) {
      error.value = e?.message ?? 'Не удалось загрузить устав';
      return false;
    } finally {
      uploading.value = false;
    }
  }

  return { charter, uploading, loading, error, load, upload };
}
