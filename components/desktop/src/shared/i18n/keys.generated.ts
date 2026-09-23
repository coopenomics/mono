// Сгенерировано `node scripts/check-i18n.mjs types --write` из словарей — не править руками.
// Опечатка в ключе t('…') становится ошибкой типов; ключ, собранный в рантайме,
// обязан начинаться с существующего раздела: t(`capital.issue.status.${status}`).

/* eslint-disable */
export type MessageKey =
  | 'common.action.add'
  | 'common.action.back'
  | 'common.action.cancel'
  | 'common.action.close'
  | 'common.action.confirm'
  | 'common.action.copy'
  | 'common.action.create'
  | 'common.action.delete'
  | 'common.action.download'
  | 'common.action.edit'
  | 'common.action.next'
  | 'common.action.open'
  | 'common.action.retry'
  | 'common.action.save'
  | 'common.action.search'
  | 'common.action.sign'
  | 'common.action.submit'
  | 'common.answer.no'
  | 'common.answer.yes'
  | 'common.state.empty'
  | 'common.state.loading'
  | 'errors.CHAIN_ASSERT'
  | 'errors.COMMON_BAD_REQUEST'
  | 'errors.COMMON_CONFLICT'
  | 'errors.COMMON_FORBIDDEN'
  | 'errors.COMMON_INTERNAL'
  | 'errors.COMMON_NOT_FOUND'
  | 'errors.COMMON_UNAUTHORIZED'
  | 'membership.exitConfirm.backToCabinet'
  | 'membership.exitConfirm.doneText'
  | 'membership.exitConfirm.doneTitle'
  | 'membership.exitConfirm.expiredLink'
  | 'membership.exitConfirm.failedTitle'
  | 'membership.exitConfirm.goToCabinet'
  | 'membership.exitConfirm.loading'
  | 'membership.exitConfirm.missingToken'
  | 'membership.exitConfirm.signIn'
  | 'membership.exitConfirm.signInHint'
  | 'validation.date.invalidFormat'
  | 'validation.date.tooEarly'
  | 'validation.date.tooLate'
  | 'validation.domain'
  | 'validation.email'
  | 'validation.personalName'
  | 'validation.required';

export type MessageBranch =
  | 'common'
  | 'common.action'
  | 'common.answer'
  | 'common.state'
  | 'errors'
  | 'membership'
  | 'membership.exitConfirm'
  | 'validation'
  | 'validation.date';

export type DynamicMessageKey = `${MessageBranch}.${string}`;
