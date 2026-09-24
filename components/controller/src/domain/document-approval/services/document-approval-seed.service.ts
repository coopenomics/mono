import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { VARS_DATA_PORT, type VarsDataPort } from '~/domain/system/ports/vars-data.port';
import { DRAFT_BLOCKCHAIN_PORT, type DraftBlockchainPort } from '~/domain/common/ports/draft-blockchain.port';
import { DocumentApprovalRequirement } from '../enums/document-approval.enums';
import type { DocumentTemplateView } from '../interfaces/document-template-view.interface';
import { DocumentApprovalStateService } from './document-approval-state.service';
import { nowChainTimePoint, toChainTimePoint } from './decision-date';

export interface DocumentApprovalSeedItem {
  registry_id: number;
  title: string;
  /** Редакция в сети, которая будет записана утверждённой. */
  version: number;
  /** Номер решения из настроек кооператива; 0, если там не число. */
  decision_id: number;
  /** Дата решения в формате цепи. */
  approved_at: string;
  /** Откуда взяты реквизиты — поле `vars`. */
  vars_field: string;
  /** Как записано в настройках: номер протокола и дата. */
  protocol_number: string;
  protocol_day_month_year: string;
}

export interface DocumentApprovalSeedResult {
  planned: number;
  applied: number;
  failed: number[];
}

/** Пауза после старта: даём цепи, парсеру и реестру деклараций подняться. */
const SEED_ON_START_DELAY_MS = 45_000;

interface ProtocolRequisites {
  protocol_number?: string | null;
  protocol_day_month_year?: string | null;
}

/**
 * Перенос утверждений действующего кооператива из прежних настроек в цепь.
 *
 * До фабрики факт утверждения жил в `vars` кооператива: номер и дата протокола
 * без номера редакции. Чтобы в день выката никого не попросили переподписать,
 * каждому документу с реквизитами протокола в `vars` и без строки утверждения
 * записывается утверждение текущей редакции сети с этими реквизитами.
 *
 * Перенос идемпотентен: документ со строкой утверждения в план не попадает,
 * поэтому повторный запуск ничего не меняет. Документы без реквизитов не
 * трогаются — они и прежде пайщикам не показывались.
 */
@Injectable()
export class DocumentApprovalSeedService implements OnApplicationBootstrap {
  constructor(
    private readonly state: DocumentApprovalStateService,
    @Inject(VARS_DATA_PORT)
    private readonly vars: VarsDataPort,
    @Inject(DRAFT_BLOCKCHAIN_PORT)
    private readonly draftChain: DraftBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DocumentApprovalSeedService.name);
  }

  onApplicationBootstrap(): void {
    if (!config.document_approval.seed_on_start) return;
    // timing: schedule — разовый перенос утверждений после старта узла; сигнала готовности цепи и реестра деклараций нет
    const timer = setTimeout(() => {
      this.apply(config.coopname).catch((error) => {
        this.logger.error(`Перенос утверждений при старте не удался: ${errorMessage(error)}`);
      });
    }, SEED_ON_START_DELAY_MS);
    timer.unref();
  }

  /** Что будет записано, без транзакций. */
  public async plan(coopname: string): Promise<DocumentApprovalSeedItem[]> {
    const [templates, vars] = await Promise.all([this.state.getTemplates(coopname), this.vars.get()]);
    if (!vars) return [];

    return templates
      .map((template) => toSeedItem(template, vars as Record<string, unknown>))
      .filter((item): item is DocumentApprovalSeedItem => item !== null);
  }

  /** Записывает утверждения по плану; ошибки по отдельным документам не останавливают остальные. */
  public async apply(coopname: string): Promise<DocumentApprovalSeedResult> {
    const items = await this.plan(coopname);
    const result: DocumentApprovalSeedResult = { planned: items.length, applied: 0, failed: [] };
    if (items.length === 0) return result;

    this.logger.info(`Перенос утверждений из настроек кооператива: ${items.length} документов`);
    for (const item of items) {
      try {
        await this.draftChain.approveDraft({
          coopname,
          username: coopname,
          registry_id: item.registry_id,
          version: item.version,
          decision_id: item.decision_id,
          approved_at: item.approved_at,
          text_hash: (await this.state.getCurrentTextHash(item.registry_id)) ?? '0'.repeat(64),
        });
        result.applied += 1;
        this.logger.info(
          `Документ ${item.registry_id}: утверждена редакция ${item.version} по протоколу ${item.protocol_number} от ${item.protocol_day_month_year}`
        );
      } catch (error) {
        result.failed.push(item.registry_id);
        this.logger.error(`Документ ${item.registry_id}: перенос утверждения не удался — ${errorMessage(error)}`);
      }
    }
    return result;
  }
}

/** Строка плана для документа с реквизитами протокола в `vars` и без утверждения; иначе `null`. */
function toSeedItem(template: DocumentTemplateView, vars: Record<string, unknown>): DocumentApprovalSeedItem | null {
  if (template.approval !== DocumentApprovalRequirement.Required) return null;
  if (template.approved_version !== null || template.current_version === null || !template.vars_field) return null;

  const requisites = vars[template.vars_field] as ProtocolRequisites | undefined;
  const protocol_number = requisites?.protocol_number?.trim();
  const protocol_day_month_year = requisites?.protocol_day_month_year?.trim();
  if (!protocol_number || !protocol_day_month_year) return null;

  return {
    registry_id: template.registry_id,
    title: template.title,
    version: template.current_version,
    decision_id: /^\d+$/.test(protocol_number) ? Number(protocol_number) : 0,
    approved_at: toChainTimePoint(protocol_day_month_year) ?? nowChainTimePoint(),
    vars_field: template.vars_field,
    protocol_number,
    protocol_day_month_year,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
