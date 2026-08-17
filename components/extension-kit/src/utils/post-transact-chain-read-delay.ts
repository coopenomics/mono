import { platformSettings } from '../config/platform-settings';

/**
 * Пауза перед чтением таблиц блокчейна сразу после успешной мутации (push_transaction).
 * На узле-последователе строка может появиться в chain state с задержкой относительно ответа RPC.
 */
export async function waitAfterTransactBeforeChainTableRead(): Promise<void> {
  const ms = platformSettings().blockchain.postTransactChainReadDelayMs;
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
