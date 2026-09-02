import { Inject, Injectable } from '@nestjs/common';
import { MonoAccountStatus } from '@coopenomics/innercoop';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { mapUserRoleToCoreRoles, type CoreRole } from './core-roles.mapper';
import { EDUBRIDGE_ROLE_FACTS_PORT, type IEdubridgeRoleFactsPort } from './edubridge-role-facts.port';
import { mapCoreRolesToEdubridgeRoles, type EdubridgeRole, type EdubridgeRoleFacts } from './edubridge-roles.mapper';

/** Пользователь запроса (JWT) либо гость. */
export interface IEdubridgeRequester {
  username?: string;
  role?: string;
  status?: MonoAccountStatus;
}

export interface IEdubridgeMembership {
  username: string | null;
  coreRoles: CoreRole[];
  roles: EdubridgeRole[];
  facts: EdubridgeRoleFacts;
  /** ЦПП принята советом — рабочие права выдаются. */
  onboarded: boolean;
}

const NO_FACTS: EdubridgeRoleFacts = { isLearner: false, isTeacher: false, isAdmin: false };

/**
 * Единственное место, где пользователь превращается в роли приложения.
 * Им пользуются и провайдер грантов (стол), и guard резолверов (enforcement),
 * поэтому «что видно» и «что можно» не расходятся.
 */
@Injectable()
export class EdubridgeMembershipService {
  constructor(
    @Inject(EDUBRIDGE_ROLE_FACTS_PORT) private readonly roleFacts: IEdubridgeRoleFactsPort,
    private readonly config: EdubridgeConfigHolder
  ) {}

  async resolve(coopname: string, requester: IEdubridgeRequester | null | undefined): Promise<IEdubridgeMembership> {
    const onboarded = Boolean((await this.config.load()).coopAcceptance.accepted);
    const guest: IEdubridgeMembership = { username: null, coreRoles: [], roles: ['guest'], facts: NO_FACTS, onboarded };
    if (!requester?.username || requester.status !== MonoAccountStatus.Active) return guest;

    const coreRoles = mapUserRoleToCoreRoles(requester.role);
    if (coreRoles.length === 0) return guest;

    if (!onboarded) {
      return { username: requester.username, coreRoles, roles: ['guest'], facts: NO_FACTS, onboarded };
    }

    const facts = await this.roleFacts.resolve(coopname, requester.username);
    return {
      username: requester.username,
      coreRoles,
      roles: mapCoreRolesToEdubridgeRoles(coreRoles, facts),
      facts,
      onboarded,
    };
  }
}
