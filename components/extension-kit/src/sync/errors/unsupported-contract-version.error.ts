/**
 * Story 6.5 (Epic 6): сигнализирует, что mapper не смог разобрать дельту блокчейна
 * (mapDeltaToBlockchainData вернул null). Бросается из `AbstractEntitySyncService.processDelta`
 * в strict-mode (`config.blockchain.unsupported_version_strict=true`).
 *
 * В non-strict режиме (default) ошибка не бросается — пишется только `logger.error` для
 * аудита; парсер ACK'нет fork-event-like (поведение совместимое с текущим).
 */
export class UnsupportedContractVersionError extends Error {
  constructor(
    public readonly entityName: string,
    public readonly context: {
      contract?: string;
      table?: string;
      primary_key?: string | number;
      block_num?: number;
    }
  ) {
    super(
      `Unsupported contract version while mapping delta for ${entityName}: ${JSON.stringify(context)}`
    );
    this.name = 'UnsupportedContractVersionError';
  }
}
