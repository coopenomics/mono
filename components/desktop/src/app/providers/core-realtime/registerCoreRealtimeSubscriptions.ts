import { registerRealtimeSubscription } from 'src/shared/lib/realtime';
import { createNodeSyncSubscription } from 'src/entities/System/model/nodeSyncSubscription';

/**
 * Регистрация ПЛАТФОРМЕННЫХ realtime-подписок в универсальный канал ядра.
 *
 * Тот же приём, что и с глобальными оверлеями: App-шелл о конкретных подписках
 * не знает. Подписки РАСШИРЕНИЙ регистрируются в их `install.ts`, не здесь.
 */
let registered = false;

export function registerCoreRealtimeSubscriptions(): void {
  if (registered) return;
  registered = true;
  registerRealtimeSubscription(createNodeSyncSubscription());
}
