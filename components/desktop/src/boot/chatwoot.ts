import { boot } from 'quasar/wrappers';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';

export default boot(async ({ app }) => {
  // ChatWoot работает только на клиенте
  if (process.env.SERVER) {
    return;
  }

  try {
    // Динамический импорт ChatWoot только на клиенте
    const { createChatWoot, useChatWoot } = await import('@productdevbook/chatwoot/vue');

    // Глобальная инициализация ChatWoot - оборачиваем в отдельный try-catch
    let chatwoot;
    try {
      chatwoot = createChatWoot({

      init: {
        websiteToken: '5Fk9KiCGW3HaSD6qj8Rijgho',
        baseUrl: 'https://support.coopenomics.world'
      },
      settings: {
        locale: 'ru',
        position: 'right',
        launcherTitle: '',
        hideMessageBubble: true
      },
      partytown: false,
      });
    } catch (initError) {
      console.error('Failed to create ChatWoot instance:', initError);
      return; // Выходим из функции, не продолжаем инициализацию
    }

    try {
      app.use(chatwoot);
    } catch (useError) {
      console.error('Failed to use ChatWoot plugin:', useError);
      return; // Выходим из функции
    }

    // Регистрируем действие для открытия чата
    const actionsStore = useActionsStore();

    // SDK ChatWoot грузится с внешнего хоста (support.coopenomics.world).
    // Ждём готовности SDK с ЖЁСТКИМ таймаутом — без него опрос длился бы вечно,
    // если хост недоступен.
    const waitForChatWootReady = (timeoutMs = 15000): Promise<boolean> => {
      return new Promise((resolve) => {
        if (window.chatwootSDK) {
          resolve(true);
          return;
        }

        const startedAt = Date.now();
        const checkReady = () => {
          if (window.chatwootSDK) {
            resolve(true);
          } else if (Date.now() - startedAt >= timeoutMs) {
            resolve(false);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    };

    // КРИТИЧНО: НЕ await — вся доинициализация чата уходит в отделённую задачу.
    // Boot-файл завершается сразу после app.use(chatwoot), поэтому недоступный
    // support.coopenomics.world больше НЕ блокирует загрузку приложения
    // (раньше `await waitForChatWootReady()` без таймаута вешал весь boot →
    // бесконечный спиннер при недоступной поддержке).
    void (async () => {
      const ready = await waitForChatWootReady();
      if (!ready) {
        console.warn(
          'ChatWoot SDK не загрузился (support недоступен) — чат отключён, ' +
          'загрузка приложения при этом не блокируется',
        );
        return;
      }

      let toggle, setUser, setCustomAttributes;
      try {
        const chatwootApi = useChatWoot();
        toggle = chatwootApi.toggle;
        setUser = chatwootApi.setUser;
        setCustomAttributes = chatwootApi.setCustomAttributes;
      } catch (apiError) {
        console.error('Failed to get ChatWoot API:', apiError);
        return;
      }

      try {
        // Получаем доступ к stores
        const sessionStore = useSessionStore();
        const systemStore = useSystemStore();

        // Устанавливаем кастомные атрибуты
        const customAttributes: Record<string, string> = {};

        if (sessionStore.username) {
          customAttributes.username = sessionStore.username;
        }

        if (systemStore.info?.coopname) {
          customAttributes.coopname = systemStore.info.coopname;
        }

        if (sessionStore.privateAccount?.type) {
          customAttributes.account_type = sessionStore.privateAccount.type;
        }

        if (sessionStore.displayName) {
          customAttributes.full_name = sessionStore.displayName;
        }

        // Добавляем текущий сайт
        if (typeof window !== 'undefined' && window.location) {
          customAttributes.current_url = window.location.href;
          customAttributes.origin = window.location.origin;
        }

        // Устанавливаем информацию о пользователе
        if (sessionStore.username && setUser) {
          setUser(sessionStore.username, {
            email: sessionStore.providerAccount?.email || '',
            name: sessionStore.displayName || sessionStore.username,
            avatar_url: '',
            identifier_hash: '',
            company_name: systemStore.cooperativeDisplayName || '',
            description: JSON.stringify(customAttributes)
          });
        }

        // Устанавливаем кастомные атрибуты контакта
        if (Object.keys(customAttributes).length > 0 && setCustomAttributes) {
          setCustomAttributes(customAttributes);
        }

        if (actionsStore && toggle) {
          actionsStore.registerAction('toggleSupportChat', () => {
            toggle('open');
          });
        }

        console.log('ChatWoot initialized globally and action registered');
      } catch (setupError) {
        console.error('Failed to setup ChatWoot user and actions:', setupError);
      }
    })();
  } catch (error) {
    console.error('Failed to initialize ChatWoot globally:', error);
  }
});
