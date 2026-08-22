export const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_KEY: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
  INVITE: 'invite',
  CONFIRM_EXIT: 'confirmExit',
} as const;

export type TokenType = (typeof tokenTypes)[keyof typeof tokenTypes];

export interface IToken {
  token: string;
  user: string;
  type: TokenType;
  expires: Date;
  blacklisted: boolean;
}
