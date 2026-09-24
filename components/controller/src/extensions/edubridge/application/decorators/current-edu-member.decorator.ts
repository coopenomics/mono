import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { DomainError } from '@coopenomics/extension-kit';

/** Членство запросившего, вычисленное `EdubridgeAccessGuard`. Для гостя `username === null`. */
export const CurrentEduMember = createParamDecorator((_data: unknown, context: ExecutionContext): IEdubridgeMembership => {
  const gqlContext = GqlExecutionContext.create(context).getContext();
  const membership = gqlContext[EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY] as IEdubridgeMembership | undefined;
  if (!membership) {
    throw DomainError.internal('EDUBRIDGE_MEMBER_CONTEXT_NOT_INITIALIZED');
  }
  return membership;
});
