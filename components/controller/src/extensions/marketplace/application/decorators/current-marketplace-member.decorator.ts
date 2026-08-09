import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';

/**
 * Извлекает `IMarketplaceCurrentMember` из GraphQL-context, куда его положил
 * `MarketplaceMembershipGuard` (Story 1.3). Если context пуст — guard либо не
 * сработал, либо был обойдён `server-secret` без последующей подмены; в этом
 * случае подняли UnauthorizedException, чтобы не получить runtime-crash
 * при попытке прочитать `currentMember.core_roles`.
 */
export const CurrentMarketplaceMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): IMarketplaceCurrentMember => {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const currentMember =
      (gqlContext?.currentMember as IMarketplaceCurrentMember | undefined) ??
      (gqlContext?.req?.currentMember as IMarketplaceCurrentMember | undefined);

    if (!currentMember) {
      throw new UnauthorizedException(
        'MarketplaceMembershipGuard не отработал — currentMember отсутствует в context'
      );
    }

    return currentMember;
  }
);
