import type { ILoggerPort } from '@coopenomics/innercoop';

/**
 * Проход фонового повтора с адресом сети на момент прохода. Повторы, замкнувшие
 * адрес первого старта, после смены адреса председателем били в старый до
 * перезапуска узла (C28-80). Ошибку прохода пишет в журнал и не выпускает:
 * вызов приходит из таймера.
 */
export async function retryWithCurrentApiUrl(
  resolveApiUrl: () => Promise<string>,
  run: (apiUrl: string) => Promise<unknown>,
  logger: ILoggerPort
): Promise<void> {
  try {
    await run(await resolveApiUrl());
  } catch (error) {
    logger.error(`Повтор доставки в сеть карт не выполнен: ${(error as Error)?.message}`);
  }
}
