import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { IGlobalSearchHook, InnerGlobalSearchContext, InnerGlobalSearchHit } from '@coopenomics/innercoop';
import {
  SEARCH_PRIVATE_ACCOUNTS_REPOSITORY,
  type SearchPrivateAccountsRepository,
} from '~/domain/common/repositories/search-private-accounts.repository';
import type { PrivateAccountSearchResultDomainInterface } from '~/domain/common/interfaces/search-private-accounts-domain.interface';
import { t } from '~/i18n';
import { isCouncilRole } from '~/shared/utils/council-roles';
import { personFullName } from '~/shared/utils/person-name';
import { GlobalSearchRegistry } from '../global-search.registry';
import { CORE_SEARCH_EXTENSION } from './core-search.constants';

/**
 * Пайщики в едином поиске: ФИО, ИНН, ОГРН, наименование организации. Реестр
 * пайщиков с личными данными открыт только совету — остальным группа пуста.
 * Находка ведёт на страницу пайщика в столе совета.
 */
@Injectable()
export class ParticipantsSearchProvider implements IGlobalSearchHook, OnModuleInit {
  readonly extensionName = CORE_SEARCH_EXTENSION;
  readonly key = 'participants';
  readonly title = t('account.globalSearch.participantsGroup');
  readonly icon = 'groups';
  readonly order = 10;

  constructor(
    private readonly registry: GlobalSearchRegistry,
    @Inject(SEARCH_PRIVATE_ACCOUNTS_REPOSITORY) private readonly accounts: SearchPrivateAccountsRepository
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async search(query: string, context: InnerGlobalSearchContext, limit: number): Promise<InnerGlobalSearchHit[]> {
    if (!isCouncilRole(context.userRole)) return [];
    const results = await this.accounts.searchPrivateAccounts({ query });
    return results
      .map((result) => toHit(result, context.coopname))
      .filter((hit): hit is InnerGlobalSearchHit => hit !== null)
      .slice(0, limit);
  }
}

function toHit(result: PrivateAccountSearchResultDomainInterface, coopname: string): InnerGlobalSearchHit | null {
  const data = result.data;
  const username = data.username;
  if (!username) return null;
  const isOrganization = 'short_name' in data;
  const title = (isOrganization ? data.short_name || data.full_name : personFullName(data)) || username;
  return {
    key: username,
    title,
    subtitle: username,
    icon: isOrganization ? 'business' : 'person',
    route: { name: 'participant-details', params: { coopname, username } },
  };
}
