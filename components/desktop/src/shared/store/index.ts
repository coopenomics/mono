// store/global.ts
import { Action, PrivateKey } from '@wharfkit/antelope';
import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { decrypt, encrypt, hashSHA256 } from '../api/crypto';
import { IMessageSignature } from '../lib/types/crypto';
import { TransactResult } from '@wharfkit/session';
import { readBlockchain } from '../api';
import { ITokens } from '../lib/types/user';
import { getFromIndexedDB, setToIndexedDB } from '../api/indexDB';
import { client } from '../api/client';
import { useSystemStore } from 'src/entities/System/model';

interface IGlobalStore {
  hasCreditials: Ref<boolean>;
  username: Ref<string>;
  tokens: Ref<ITokens | undefined>;
  wif: Ref<PrivateKey | undefined>;
  setWif: (newUsername: string, key: string) => Promise<void>;
  setTokens: (newTokens: ITokens) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
  signDigest: (digest: string) => IMessageSignature;
  hashMessage: (message: string | Uint8Array) => Promise<string>;
  formActionFromAbi: (action: any) => any;
  transact: (
    actionOrActions: any | any[],
  ) => Promise<TransactResult | undefined>;
}

export const useGlobalStore = defineStore('global', (): IGlobalStore => {
  const username = ref<string>('');
  const wif = ref<PrivateKey | undefined>(undefined);
  const hasCreditials = ref(false);
  const tokens = ref<ITokens | undefined>(undefined);

  const password = ''; // это временное намеренное решение. Позже заменим на пользовательский пин-код.

  const { info } = useSystemStore();

  // Инициализация
  const init = async () => {
    try {
      // Получите зашифрованный ключ и токены из хранилища
      const encryptedKey = await getFromIndexedDB(
        info.coopname,
        'store',
        'encryptedKey',
      );
      const encryptedTokens = await getFromIndexedDB(
        info.coopname,
        'store',
        'encryptedTokens',
      );
      const encryptedUsername = await getFromIndexedDB(
        info.coopname,
        'store',
        'encryptedUsername',
      );

      // Если ключ или токены не найдены, выбросите ошибку
      if (!encryptedKey || !encryptedTokens || !encryptedUsername) {
        return;
      }

      // Расшифруйте ключ и токены
      const decryptedKey = await decrypt(encryptedKey, password);
      const decryptedTokens = await decrypt(encryptedTokens, password);
      const decryptedUsername = await decrypt(encryptedUsername, password);

      // Установите расшифрованный ключ и токены
      wif.value = PrivateKey.fromString(decryptedKey);
      tokens.value = JSON.parse(decryptedTokens);
      username.value = decryptedUsername;

      // Установите hasCreditials в true
      hasCreditials.value = true;

      if (tokens.value?.access.token) {
        client.setToken(tokens.value.access.token);
      }

      if (decryptedKey && decryptedUsername) {
        client.setWif(decryptedUsername, decryptedKey);
      }
    } catch {
      await setToIndexedDB(info.coopname, 'store', 'encryptedKey', '');
      await setToIndexedDB(info.coopname, 'store', 'encryptedUsername', '');
      await setToIndexedDB(info.coopname, 'store', 'encryptedTokens', '');
      throw new Error('Ошибка авторизации. Войдите повторно.');
    }
  };

  const setWif = async (newUsername: string, key: string) => {
    const encryptedKey = await encrypt(key, password);
    const encryptedUsername = await encrypt(newUsername, password);

    await setToIndexedDB(info.coopname, 'store', 'encryptedKey', encryptedKey);
    await setToIndexedDB(
      info.coopname,
      'store',
      'encryptedUsername',
      encryptedUsername,
    );

    wif.value = PrivateKey.fromString(key);
    username.value = newUsername;
  };

  const setTokens = async (newTokens: ITokens) => {
    const encryptedTokens = await encrypt(JSON.stringify(newTokens), password);
    await setToIndexedDB(
      info.coopname,
      'store',
      'encryptedTokens',
      encryptedTokens,
    );
    tokens.value = newTokens;
  };

  const logout = async () => {
    username.value = '';
    wif.value = undefined;
    hasCreditials.value = false;
    tokens.value = undefined;
    await setToIndexedDB(info.coopname, 'store', 'encryptedKey', '');
    await setToIndexedDB(info.coopname, 'store', 'encryptedUsername', '');
    await setToIndexedDB(info.coopname, 'store', 'encryptedTokens', '');
    // Сбрасываем активный workspace из localStorage
    localStorage.removeItem('monocoop-active-workspace');
  };

  const signDigest = (digest: string): IMessageSignature => {
    if (!wif.value) throw new Error('ключ не найден');

    const signed = wif.value.signDigest(digest);
    const verified = signed.verifyDigest(digest, wif.value.toPublic());

    if (!verified) throw new Error('Подпись не верифицирована');

    const result: IMessageSignature = {
      message: digest,
      signature: signed.toString(),
      public_key: wif.value.toPublic().toString(),
    };
    return result;
  };

  const hashMessage = (message: string | Uint8Array) => {
    return hashSHA256(message);
  };

  async function transact(
    actionOrActions: any | any[],
    broadcast = true,
  ): Promise<TransactResult | undefined> {
    if (Array.isArray(actionOrActions)) {
      return await sendActions(actionOrActions, broadcast);
    } else {
      return await sendAction(actionOrActions, broadcast);
    }
  }
  // Кэш ABI контрактов. Раньше каждое действие пайщика тянуло ABI с ноды заново
  // (для soviet это ~26 КБ и отдельный round-trip), а ABI меняется только при
  // деплое контракта. На HTTP/1.1 браузер держит всего 6 соединений на origin —
  // тот же бюджет делят вызовы цепи и GraphQL, поэтому лишний запрос на каждое
  // действие реально стоит места в очереди.
  //
  // Инвалидация двухступенчатая, потому что по отдельности ни одна не годится:
  //   • TTL — страхует от бесконечно протухшей записи во вкладке, которую не
  //     перезагружали. Сверять хэш ABI перед использованием бессмысленно: сама
  //     сверка — это запрос к ноде, ровно то, от чего уходим.
  //   • Сброс при ЛЮБОЙ неудачной транзакции — основной предохранитель. После
  //     деплоя контракта со сменой сигнатуры действия старый ABI даёт ошибку
  //     сериализации; кэш сбрасывается, и повтор пайщика уже уходит с новым ABI.
  //     Сбрасываем не разбирая текст ошибки — дешевле один лишний get_abi на
  //     редкий сбой, чем разбор сообщений цепи, который разъедется с версией.
  //
  // Повтор транзакции автоматически НЕ делаем: она могла успеть уйти в цепь, и
  // авто-ретрай означал бы риск двойного голоса или двойного платежа.
  const ABI_TTL_MS = 5 * 60 * 1000;
  const abiCache = new Map<string, { abi: any; fetchedAt: number }>();

  const dropAbiCache = (accounts: string[]) => {
    for (const account of accounts) abiCache.delete(account);
  };

  const formActionFromAbi = async (action: any) => {
    const account = String(action.account);
    const cached = abiCache.get(account);

    if (cached && Date.now() - cached.fetchedAt < ABI_TTL_MS) {
      return Action.from(action, cached.abi);
    }

    const { abi } = (await readBlockchain?.v1.chain.get_abi(account)) ?? {
      abi: undefined,
    };

    // Пустой ABI не кэшируем: это не «контракт без интерфейса», а неответ ноды.
    if (abi) abiCache.set(account, { abi, fetchedAt: Date.now() });

    return Action.from(action, abi);
  };

  const sendAction = async (action: any, broadcast: boolean) => {
    // Получаем хранилище сессии с помощью импорта, избегая циклической зависимости
    const sessionStore = (
      await import('src/entities/Session')
    ).useSessionStore();
    const formedAction = await formActionFromAbi(action);

    try {
      return await sessionStore.session?.transact(
        {
          action: formedAction,
        },
        { broadcast },
      );
    } catch (e) {
      dropAbiCache([String(action.account)]);
      throw e;
    }
  };

  const sendActions = async (actions: any[], broadcast: boolean) => {
    // Получаем хранилище сессии с помощью импорта, избегая циклической зависимости
    const sessionStore = (
      await import('src/entities/Session')
    ).useSessionStore();
    const data: Action[] = [];

    for (const action of actions) {
      const formedAction = await formActionFromAbi(action);
      data.push(formedAction);
    }

    try {
      return await sessionStore.session?.transact(
        {
          actions: data,
        },
        { broadcast },
      );
    } catch (e) {
      dropAbiCache(actions.map((action) => String(action.account)));
      throw e;
    }
  };

  return {
    init,
    username,
    wif,
    hasCreditials,
    tokens,
    setWif,
    setTokens,
    logout,
    signDigest,
    hashMessage,
    transact,
    formActionFromAbi,
  };
});
