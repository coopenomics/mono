import { Injectable } from '@nestjs/common';
import { FIRST_BUILDER_VERSION } from '@coopenomics/docs-factory';
import { GeneratorInfrastructureService } from '~/infrastructure/generator/generator.service';
import type {
  DocumentReproducibilityAuditDTO,
  DocumentReproducibilityAuditInputDTO,
  DocumentReproducibilityAuditMismatchDTO,
  DocumentReproducibilityAuditRowDTO,
} from '../dto/document-reproducibility-audit.dto';

/** Чем разошёлся пересобранный документ с сохранённым. */
enum AuditOutcome {
  REPRODUCED = 'reproduced',
  PDF_MISMATCH = 'pdf',
  HTML_MISMATCH = 'html',
  FAILED = 'failed',
}

/**
 * Аудит пересборки сохранённых документов узла (фабрика v2, шаг 0; FR44–FR45).
 *
 * Каждый сохранённый документ пересобирается по своим метаданным без
 * сохранения и сравнивается с тем, что лежит в хранилище: сначала HTML,
 * затем хэш PDF. Отчёт считается по виду документа и версии сборщика
 * (`meta.builder`; документ до оси версий — `1.0`, шаг 7) и не содержит
 * содержимого документов — только номера,
 * версии и причину расхождения.
 *
 * Первый прогон до рефакторинга даёт исходный долг воспроизводимости;
 * после каждого шага рефакторинга отчёт обязан быть не хуже.
 */
/** Версия сборщика документа; у документа до оси версий её нет — это `1.0`. */
function builderOf(meta: { builder?: string }): string {
  return meta.builder ?? FIRST_BUILDER_VERSION;
}

@Injectable()
export class DocumentReproducibilityAuditService {
  constructor(private readonly generator: GeneratorInfrastructureService) {}

  async audit(input: DocumentReproducibilityAuditInputDTO): Promise<DocumentReproducibilityAuditDTO> {
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 100;

    const stored = await this.generator.countStoredDocuments(input.registry_id);
    const documents = await this.generator.listStoredDocuments({ registry_id: input.registry_id, offset, limit });

    const rows = new Map<string, DocumentReproducibilityAuditRowDTO>();
    const mismatches: DocumentReproducibilityAuditMismatchDTO[] = [];

    for (const document of documents) {
      const builder = builderOf(document.meta);
      const key = `${document.meta.registry_id}:${builder}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          registry_id: document.meta.registry_id,
          version: builder,
          total: 0,
          reproduced: 0,
          pdf_mismatch: 0,
          html_mismatch: 0,
          failed: 0,
        };
        rows.set(key, row);
      }
      row.total += 1;

      const { outcome, reason } = await this.check(document);
      switch (outcome) {
        case AuditOutcome.REPRODUCED:
          row.reproduced += 1;
          break;
        case AuditOutcome.PDF_MISMATCH:
          row.pdf_mismatch += 1;
          break;
        case AuditOutcome.HTML_MISMATCH:
          row.html_mismatch += 1;
          break;
        case AuditOutcome.FAILED:
          row.failed += 1;
          break;
      }
      if (outcome !== AuditOutcome.REPRODUCED) {
        mismatches.push({
          hash: document.hash,
          registry_id: document.meta.registry_id,
          version: builder,
          block_num: document.meta.block_num,
          reason,
        });
      }
    }

    return {
      stored,
      checked: documents.length,
      next_offset: Math.min(stored, offset + documents.length),
      rows: [...rows.values()].sort((a, b) => a.registry_id - b.registry_id || a.version.localeCompare(b.version)),
      mismatches,
    };
  }

  private async check(
    document: Awaited<ReturnType<GeneratorInfrastructureService['listStoredDocuments']>>[number]
  ): Promise<{ outcome: AuditOutcome; reason: string }> {
    try {
      // Пересборка по мете: та же дата, тот же блок, та же редакция шаблона.
      const rebuilt = await this.generator.generate({ ...document.meta }, { skip_save: true });
      if (rebuilt.html !== document.html) {
        return { outcome: AuditOutcome.HTML_MISMATCH, reason: AuditOutcome.HTML_MISMATCH };
      }
      if (rebuilt.hash !== document.hash) {
        return { outcome: AuditOutcome.PDF_MISMATCH, reason: AuditOutcome.PDF_MISMATCH };
      }
      return { outcome: AuditOutcome.REPRODUCED, reason: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { outcome: AuditOutcome.FAILED, reason: message.slice(0, 300) };
    }
  }
}
