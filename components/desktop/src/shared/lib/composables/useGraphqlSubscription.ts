import { ref, onUnmounted, type Ref } from 'vue';
import { createClient, type Client } from 'graphql-ws';
import { useGlobalStore } from 'src/shared/store';
import { env } from 'src/shared/config';

let sharedClient: Client | null = null;
let activeSubscribers = 0;

function getWsUrl(): string {
  const httpUrl = env.BACKEND_URL + '/v1/graphql';
  return httpUrl.replace(/^http/, 'ws');
}

function getOrCreateClient(): Client {
  if (sharedClient) return sharedClient;

  const globalStore = useGlobalStore();

  sharedClient = createClient({
    url: getWsUrl(),
    connectionParams: () => ({
      token: globalStore.tokens?.access?.token || '',
    }),
    retryAttempts: 5,
    shouldRetry: () => true,
    on: {
      closed: () => {
        if (activeSubscribers === 0) {
          sharedClient?.dispose();
          sharedClient = null;
        }
      },
    },
  });

  return sharedClient;
}

export interface UseSubscriptionOptions<T> {
  query: string;
  variables?: Record<string, any>;
  onData: (data: T) => void;
  onError?: (error: any) => void;
  enabled?: Ref<boolean>;
}

/**
 * Composable для GraphQL подписок через graphql-ws.
 * Автоматически подключается к WebSocket с JWT токеном.
 * Автоматически отписывается при уничтожении компонента.
 */
export function useGraphqlSubscription<T = any>(options: UseSubscriptionOptions<T>) {
  const isConnected = ref(false);
  let unsubscribe: (() => void) | null = null;

  function subscribe() {
    if (unsubscribe) return;
    if (options.enabled && !options.enabled.value) return;

    const client = getOrCreateClient();
    activeSubscribers++;
    isConnected.value = true;

    unsubscribe = client.subscribe(
      {
        query: options.query,
        variables: options.variables,
      },
      {
        next(value) {
          if (value.data) {
            options.onData(value.data as T);
          }
        },
        error(error) {
          console.warn('[Subscription] Error:', error);
          options.onError?.(error);
        },
        complete() {
          isConnected.value = false;
        },
      },
    );
  }

  function stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      activeSubscribers = Math.max(0, activeSubscribers - 1);
      isConnected.value = false;
    }
  }

  subscribe();

  onUnmounted(() => {
    stop();
  });

  return {
    isConnected,
    stop,
    restart: () => {
      stop();
      subscribe();
    },
  };
}

/**
 * Утилита для формирования GraphQL subscription query строки
 */
export function buildSubscriptionQuery(
  name: string,
  args: Record<string, any> | null,
  fields: string[],
): string {
  const argsStr = args
    ? `(${Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})`
    : '';

  return `subscription { ${name}${argsStr} { ${fields.join(' ')} } }`;
}
