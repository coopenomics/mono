import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MarketContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { MarketplaceWriteoffService } from './marketplace-writeoff.service';
import type { IAction } from '~/types';

/**
 * Слушатель callback'ов совета по проекту списания скоропорта.
 *
 * Проект уходит в совет через `marketplace::propwroff` (inline
 * `soviet::createagenda(mktwroff)`). После голосования совета председатель
 * подписывает Протокол списания и `soviet::exec` вызывает один из callback'ов:
 *   - `marketplace::onmktwoauth(coopname, hash, authorization)` — совет одобрил;
 *     проект переходит ON_AGENDA → PENDING_CONFIRMATION, Протокол сохраняется.
 *   - `marketplace::onmktwodecl(coopname, hash, reason)` — отклонён/просрочен.
 *
 * Без этого слушателя одобрение совета не отражалось в проекции: статус
 * оставался «На повестке», Решение совета не прицеплялось.
 */
@Injectable()
export class MarketplaceWriteoffSyncService {
  constructor(
    private readonly writeoffService: MarketplaceWriteoffService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceWriteoffSyncService.name);
  }

  @OnEvent(
    `action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktWoAuth.actionName}`
  )
  async handleAuthorized(action: IAction): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktWoAuth.IOnMktWoAuth;
      if (!data?.coopname || !data?.hash) {
        this.logger.warn('onmktwoauth: пустые coopname/hash — пропускаю.');
        return;
      }
      // On-chain hash приходит в верхнем регистре, proposal_hash в проекции —
      // в нижнем; нормализуем, иначе findByHash не найдёт проект.
      await this.writeoffService.onCouncilAuthorized({
        coopname: data.coopname,
        proposal_hash: String(data.hash).toLowerCase(),
        authorized_by: null,
        protocol_doc: data.authorization,
      });
    } catch (err: any) {
      this.logger.error(`onmktwoauth listener упал: ${err.message}`, err.stack);
    }
  }

  @OnEvent(
    `action::${MarketContract.contractName.production}::${MarketContract.Actions.OnMktWoDecl.actionName}`
  )
  async handleDeclined(action: IAction): Promise<void> {
    try {
      const data = action.data as MarketContract.Actions.OnMktWoDecl.IOnMktWoDecl;
      if (!data?.coopname || !data?.hash) {
        this.logger.warn('onmktwodecl: пустые coopname/hash — пропускаю.');
        return;
      }
      await this.writeoffService.onCouncilDeclined({
        coopname: data.coopname,
        proposal_hash: String(data.hash).toLowerCase(),
        reason: data.reason ?? 'причина не указана',
      });
    } catch (err: any) {
      this.logger.error(`onmktwodecl listener упал: ${err.message}`, err.stack);
    }
  }
}
