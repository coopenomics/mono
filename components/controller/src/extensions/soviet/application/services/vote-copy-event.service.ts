import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VoteCopyService } from '../../domain/services/vote-copy.service';

/**
 * Слушает события голосования из блокчейна.
 * Когда source_username голосует — автоматически копирует голос для всех подписчиков.
 */
@Injectable()
export class VoteCopyEventService {
  private readonly logger = new Logger(VoteCopyEventService.name);

  constructor(private readonly voteCopyService: VoteCopyService) {}

  @OnEvent('action::soviet::votefor')
  async handleVoteFor(event: { data: { coopname: string; username: string; decision_id: number } }): Promise<void> {
    const { username, decision_id } = event.data;
    this.logger.debug(`Голос ЗА от ${username} по решению ${decision_id}`);

    try {
      const copiers = await this.voteCopyService.findActiveCopiers(username);
      if (copiers.length === 0) return;

      this.logger.log(`Копирование голоса ${username} → ${copiers.length} подписчик(ов)`);

      for (const copier of copiers) {
        try {
          // TODO: подписать голос ключом copyvote из vault и отправить votefor транзакцию
          this.logger.log(`Копирование голоса: ${copier.copier_username} копирует ${username} по решению ${decision_id}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(`Ошибка копирования голоса ${copier.copier_username}: ${msg}`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Ошибка обработки копирования: ${msg}`);
    }
  }

  @OnEvent('action::soviet::voteagainst')
  async handleVoteAgainst(event: { data: { coopname: string; username: string; decision_id: number } }): Promise<void> {
    const { username, decision_id } = event.data;
    this.logger.debug(`Голос ПРОТИВ от ${username} по решению ${decision_id}`);

    try {
      const copiers = await this.voteCopyService.findActiveCopiers(username);
      if (copiers.length === 0) return;

      this.logger.log(`Копирование голоса ПРОТИВ ${username} → ${copiers.length} подписчик(ов)`);

      for (const copier of copiers) {
        try {
          this.logger.log(`Копирование голоса ПРОТИВ: ${copier.copier_username} копирует ${username} по решению ${decision_id}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.error(`Ошибка копирования голоса ${copier.copier_username}: ${msg}`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Ошибка обработки копирования: ${msg}`);
    }
  }
}
