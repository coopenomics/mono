import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EXTENSION_APP_TERMINATE_EVENT, type ExtensionAppTerminatePayload } from '@coopenomics/extension-kit';
import type { IDocumentDeclarationPort, InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { DocumentDeclarationQueryPort } from '../ports/document-declaration-query.port';
import config from '~/config/config';
import { CORE_DOCUMENTS_OWNER, coreDocumentDeclarationsFor } from '../constants/core-document-declarations';

/**
 * Реестр шаблонов кооператива: декларации документов ядра и установленных
 * приложений, в памяти процесса.
 *
 * Наполняется расширениями через `DOCUMENT_DECLARATION_PORT` в их
 * `initialize()`, базовый набор ядро объявляет само при старте. Остановка
 * расширения снимает его декларации по `EXTENSION_APP_TERMINATE_EVENT`, чтобы
 * документы выключенного приложения не висели в реестре и не требовали
 * утверждения.
 *
 * Повторное объявление той же пары (расширение, шаблон) заменяет запись:
 * расширение перезапускается и объявляет документы заново. Один шаблон двум
 * расширениям принадлежать не может — это ошибка конфигурации, и лучше упасть
 * на старте, чем показать совету документ дважды.
 */
@Injectable()
export class DocumentDeclarationsRegistryService
  implements IDocumentDeclarationPort, DocumentDeclarationQueryPort, OnModuleInit
{
  private readonly declarations = new Map<number, InnerDocumentDeclaration>();

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(DocumentDeclarationsRegistryService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.registerDocuments(coreDocumentDeclarationsFor(config.coopname));
  }

  public async registerDocuments(declarations: InnerDocumentDeclaration[]): Promise<void> {
    for (const declaration of declarations) {
      const existing = this.declarations.get(declaration.registry_id);
      if (existing && existing.extension_name !== declaration.extension_name) {
        throw new Error(
          `Шаблон ${declaration.registry_id} уже объявлен расширением ${existing.extension_name}, повторно его объявляет ${declaration.extension_name}`
        );
      }
      if (declaration.approval === 'none' && declaration.kind !== 'service') {
        this.logger.warn(
          `Шаблон ${declaration.registry_id} (${declaration.extension_name}) объявлен без утверждения, хотя его род — ${declaration.kind}`
        );
      }
      this.declarations.set(declaration.registry_id, { ...declaration });
    }
  }

  public async unregisterByExtension(extension_name: string): Promise<void> {
    if (extension_name === CORE_DOCUMENTS_OWNER) return;
    for (const [registry_id, declaration] of this.declarations.entries()) {
      if (declaration.extension_name === extension_name) {
        this.declarations.delete(registry_id);
      }
    }
  }

  public getAll(): InnerDocumentDeclaration[] {
    return [...this.declarations.values()].sort(byExtensionAndOrder);
  }

  public getByExtension(extension_name: string): InnerDocumentDeclaration[] {
    return this.getAll().filter((d) => d.extension_name === extension_name);
  }

  public getByRegistryId(registry_id: number): InnerDocumentDeclaration | null {
    return this.declarations.get(registry_id) ?? null;
  }

  public getByBundle(extension_name: string, bundle: string): InnerDocumentDeclaration[] {
    return this.getByExtension(extension_name).filter((d) => d.bundle === bundle);
  }

  /**
   * Реестр чистит записи остановленного расширения сам — тот же tear-down,
   * что у реестра оферт. Утверждения в цепи при этом не трогаются.
   */
  @OnEvent(EXTENSION_APP_TERMINATE_EVENT)
  async onExtensionTerminate(payload: ExtensionAppTerminatePayload): Promise<void> {
    const before = this.declarations.size;
    await this.unregisterByExtension(payload.appName);
    const removed = before - this.declarations.size;
    if (removed > 0) {
      this.logger.info(`Сняты декларации документов расширения ${payload.appName}: ${removed}`);
    }
  }
}

function byExtensionAndOrder(a: InnerDocumentDeclaration, b: InnerDocumentDeclaration): number {
  if (a.extension_name === b.extension_name) return a.order - b.order;
  if (a.extension_name === CORE_DOCUMENTS_OWNER) return -1;
  if (b.extension_name === CORE_DOCUMENTS_OWNER) return 1;
  return a.extension_name.localeCompare(b.extension_name);
}
