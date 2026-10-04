
export const GITHUB_COMM_MESSAGE_CURSOR_TABLE = 'capital_github_comm_message_cursor';

export class GithubCommMessageCursorTypeormEntity {
  id!: string;

  coopname!: string;

  matrixRoomId!: string;

  lastOriginServerTs!: number;

  updatedAt!: Date;
}
