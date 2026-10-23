import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DomainError } from '@coopenomics/extension-kit';
import { EDUBRIDGE_MEMBERSHIP_KEY } from '../access/edubridge-rights';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';

/**
 * Членство запросившего, вычисленное описанием прав образования на этот
 * запрос (`EdubridgeRights.onRequest`, зовёт общий гард `RightsGuard`). Операция
 * без гарда прав членства в запросе не имеет — это ошибка сборки резолвера.
 */
export const CurrentEduMember = createParamDecorator((_data: unknown, context: ExecutionContext): IEdubridgeMembership => {
  const request = GqlExecutionContext.create(context).getContext()?.req as Record<string, unknown> | undefined;
  const membership = request?.[EDUBRIDGE_MEMBERSHIP_KEY] as IEdubridgeMembership | undefined;
  if (!membership) {
    throw DomainError.internal('EDUBRIDGE_MEMBER_CONTEXT_NOT_INITIALIZED');
  }
  return membership;
});
