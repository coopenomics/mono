import { registerEnumType } from '@nestjs/graphql';

/** Пригодность узла кооператива к работе прямо сейчас. */
export enum NodeSyncStatus {
  /** Узел у головы цепи — рабочий стол показывает актуальные данные. */
  SYNCED = 'SYNCED',
  /** Узел догоняет цепь — данные неполные, работать с ними нельзя. */
  LAGGING = 'LAGGING',
  /** Связи нет: не отвечает узел кооператива или цепь. */
  DISCONNECTED = 'DISCONNECTED',
}

registerEnumType(NodeSyncStatus, {
  name: 'NodeSyncStatus',
  description: 'Состояние синхронизации узла кооператива с цепью',
});

/** Что именно оборвалось, когда связи нет. */
export enum NodeSyncOutage {
  /** Не отвечает цепь: узел не отдаёт своё текущее состояние. */
  CHAIN = 'CHAIN',
  /** Чтение цепи остановлено: позиция чтения не двигается. */
  READER = 'READER',
  /**
   * Не отвечает сам узел кооператива. Это состояние выставляет только рабочий
   * стол, когда запрос или подписка не доходят: сервер, будь он жив, ответил
   * бы про цепь или про чтение.
   */
  NODE = 'NODE',
}

registerEnumType(NodeSyncOutage, {
  name: 'NodeSyncOutage',
  description: 'Причина отсутствия связи с цепью',
});
