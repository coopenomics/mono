import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';

/** Членство запросившего, вычисленное `EdubridgeAccessGuard`. Для гостя `username === null`. */
export const CurrentEduMember = createParamDecorator((_data: unknown, context: ExecutionContext): IEdubridgeMembership => {
  const gqlContext = GqlExecutionContext.create(context).getContext();
  const membership = gqlContext[EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY] as IEdubridgeMembership | undefined;
  if (!membership) {
    throw new Error('Контекст edubridge не инициализирован — поставьте EdubridgeAccessGuard в @UseGuards');
  }
  return membership;
});
