import { useGlobalStore } from 'src/shared/store';
import { FailAlert } from 'src/shared/api';

/**
 * Ключ для подписи; заперт кошелёк — спросит PIN-код, отказались — покажет
 * причину и вернёт `null`.
 *
 * Экраны подписи устроены одинаково: взять ключ, а без него показать ошибку и
 * выйти. Раньше ключ брали прямо из хранилища, и запертый кошелёк ронял подпись
 * с «Приватный ключ не установлен» вместо запроса PIN-кода. Здесь эта развилка
 * собрана в одном месте, а вызов остаётся прежней формы:
 *
 *     const wif = await signingKeyOrAlert();
 *     if (!wif) return;
 */
export async function signingKeyOrAlert(text?: string): Promise<string | null> {
  try {
    return await useGlobalStore().ensureSigningKey();
  }
  catch (e) {
    FailAlert(e, text);
    return null;
  }
}
