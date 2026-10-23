import { Resolver, Query, Args } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { SearchResultDTO } from '../dto/search-result.dto';
import { SearchDocumentsInputDTO } from '../dto/search-input.dto';
import { GlobalSearchGroupDTO, GlobalSearchInputDTO } from '../dto/global-search.dto';
import { GlobalSearchRegistry } from '../global-search.registry';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { isCouncilRole } from '~/shared/utils/council-roles';
import config from '~/config/config';


@Resolver()
export class SearchResolver {
  constructor(
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly signedDocuments: SignedDocumentRepository,
    private readonly globalSearchRegistry: GlobalSearchRegistry
  ) {}

  // Единый поиск окна столов и страниц: ядро опрашивает всех поставщиков —
  // своих и расширений — и отдаёт находки группами. Права проверяет каждый
  // поставщик сам по переданному пайщику.
  @Query(() => [GlobalSearchGroupDTO], {
    description: 'Единый поиск: пайщики, документы и записи приложений, сгруппированные по источнику',
  })
  @UseGuards(GqlJwtAuthGuard)
  async globalSearch(
    @Args('data') input: GlobalSearchInputDTO,
    @CurrentUser() user: IMonoAccount
  ): Promise<GlobalSearchGroupDTO[]> {
    return this.globalSearchRegistry.search(
      input.query,
      {
        coopname: config.coopname,
        username: user.username,
        userRole: user.role,
        userStatus: user.status,
      },
      input.limit ?? 5
    );
  }

  // Поиск по документам кооператива. Член совета (chairman/member) ищет по всему кооперативу;
  // обычный пайщик — ТОЛЬКО по своим документам (скоуп по username), чтобы не видеть чужие.
  @Query(() => [SearchResultDTO], { description: 'Полнотекстовый поиск по документам кооператива' })
  @UseGuards(GqlJwtAuthGuard)
  async searchDocuments(
    @Args('data') input: SearchDocumentsInputDTO,
    @CurrentUser() user: IMonoAccount
  ): Promise<SearchResultDTO[]> {
    const isCouncil = isCouncilRole(user?.role);
    const hits = await this.signedDocuments.search({
      coopname: config.coopname,
      query: input.query,
      limit: input.limit || 20,
      username: isCouncil ? undefined : user.username,
    });

    return hits.map((hit) => ({
      hash: hit.hash,
      full_title: hit.full_title,
      username: hit.username,
      signer: hit.signer,
      coopname: hit.coopname,
      registry_id: hit.registry_id,
      created_at: hit.created_at ?? undefined,
      highlights: hit.highlights,
    }));
  }
}
