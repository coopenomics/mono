import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IGlobalSearchHook, InnerGlobalSearchContext, InnerGlobalSearchHit } from '@coopenomics/innercoop';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { t } from '~/i18n';
import { isCouncilRole } from '~/shared/utils/council-roles';
import { GlobalSearchRegistry } from '../global-search.registry';
import { CORE_SEARCH_EXTENSION } from './core-search.constants';

/**
 * Документы в едином поиске — тот же поиск, что у реестра документов. Совет
 * ищет по всему документообороту кооператива и открывает документ в своём
 * столе, пайщик — только по своим документам и в столе пайщика.
 */
@Injectable()
export class DocumentsSearchProvider implements IGlobalSearchHook, OnModuleInit {
  readonly extensionName = CORE_SEARCH_EXTENSION;
  readonly key = 'documents';
  readonly title = t('document.globalSearch.documentsGroup');
  readonly icon = 'description';
  readonly order = 20;

  constructor(
    private readonly registry: GlobalSearchRegistry,
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly signedDocuments: SignedDocumentRepository
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async search(query: string, context: InnerGlobalSearchContext, limit: number): Promise<InnerGlobalSearchHit[]> {
    const isCouncil = isCouncilRole(context.userRole);
    const hits = await this.signedDocuments.search({
      coopname: context.coopname,
      query,
      limit,
      username: isCouncil ? undefined : context.username,
    });
    const routeName = isCouncil ? 'document-details' : 'user-document-details';
    return hits.map((hit) => ({
      key: hit.hash,
      title: hit.full_title,
      subtitle: hit.signer || hit.username,
      icon: 'description',
      route: { name: routeName, params: { coopname: context.coopname, hash: hit.hash } },
    }));
  }
}
