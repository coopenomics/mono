import { registerEnumType } from '@nestjs/graphql';

/**
 * Откуда пришла редакция: веб-интерфейс, CLI (blago), откат к прежней редакции, синхронизация из цепи, бэкфилл.
 */
export enum ContentRevisionOrigin {
  WEB = 'WEB',
  CLI = 'CLI',
  RESTORE = 'RESTORE',
  CHAIN = 'CHAIN',
  BACKFILL = 'BACKFILL',
}

registerEnumType(ContentRevisionOrigin, {
  name: 'CapitalContentRevisionOrigin',
  description: 'Источник редакции: WEB, CLI, RESTORE (откат), CHAIN (синхронизация из блокчейна), BACKFILL (первичный снимок)',
});
