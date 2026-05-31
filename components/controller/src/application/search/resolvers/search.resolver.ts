import { Resolver, Query, Args } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { SearchResultDTO } from '../dto/search-result.dto';
import { SearchDocumentsInputDTO } from '../dto/search-input.dto';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import config from '~/config/config';

// Роли членов совета — им доступен поиск по всему документообороту кооператива.
const COUNCIL_ROLES = ['chairman', 'member'];

@Resolver()
export class SearchResolver {
  constructor(
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly signedDocuments: SignedDocumentRepository
  ) {}

  // Поиск по документам кооператива. Член совета (chairman/member) ищет по всему кооперативу;
  // обычный пайщик — ТОЛЬКО по своим документам (скоуп по username), чтобы не видеть чужие.
  @Query(() => [SearchResultDTO], { description: 'Полнотекстовый поиск по документам кооператива' })
  @UseGuards(GqlJwtAuthGuard)
  async searchDocuments(
    @Args('data') input: SearchDocumentsInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<SearchResultDTO[]> {
    const isCouncil = COUNCIL_ROLES.includes(user?.role);
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
