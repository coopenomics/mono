import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ExtensionIdentity } from '@coopenomics/extension-sdk';

/**
 * Пайщик, сделавший запрос. Его кладёт в запрос `ExtensionAccessGuard` после
 * ответа ядра; без охранника на резолвере значения нет.
 */
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ExtensionIdentity =>
    GqlExecutionContext.create(context).getContext().req.user,
);
