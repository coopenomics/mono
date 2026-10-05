
export const GITHUB_COMM_TRANSCRIPTION_CURSOR_TABLE = 'capital_github_comm_transcription_cursor';

export class GithubCommTranscriptionCursorTypeormEntity {
  id!: string;

  coopname!: string;

  projectHash!: string;

  /** В exclusive-смысле: выбираем транскрипции с ended_at > этого значения. */
  lastEndedAtExclusive!: Date;

  updatedAt!: Date;
}
