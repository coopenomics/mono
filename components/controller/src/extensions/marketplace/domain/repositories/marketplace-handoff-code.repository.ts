export const MARKETPLACE_HANDOFF_CODE_REPOSITORY = Symbol('MARKETPLACE_HANDOFF_CODE_REPOSITORY');

export interface MarketplaceHandoffCodeRecord {
  id: string;
  coopname: string;
  account: string;
  token: string;
  issued_at: Date;
  expires_at: Date;
}

/** Временные коды передачи (598-62): выдача пайщику и поиск по коду при сканировании. */
export interface MarketplaceHandoffCodeDomainRepository {
  /** Код по строке из сканера — вместе с истёкшим, чтобы ответить «код истёк», а не «не распознан». */
  findByToken(coopname: string, token: string): Promise<MarketplaceHandoffCodeRecord | null>;
  /** Действующий код учётной записи на момент `now`, если он есть. */
  findLiveByAccount(coopname: string, account: string, now: Date): Promise<MarketplaceHandoffCodeRecord | null>;
  create(input: { coopname: string; account: string; token: string; expires_at: Date }): Promise<MarketplaceHandoffCodeRecord>;
}
