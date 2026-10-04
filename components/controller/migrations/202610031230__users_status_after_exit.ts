import { SovietContract } from 'cooptypes';
import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Пайщики, вышедшие до 03.10.2026, теряют статус «принят».
 *
 * Завершённый выход цепь отмечает действием `soviet::delpartcpnt`. До C28-87
 * узел это действие не слушал: учётная запись вышедшего оставалась `active`,
 * и он читал собрания, решения участков и списки приложений как пайщик.
 * Обработчик `ParticipantStatusSyncService.handleDeleteParticipant` правит
 * статус для новых выходов; эта миграция один раз проходит по прежним.
 *
 * Источник — сохранённые действия цепи: по каждому пайщику берётся последнее
 * из пары «принят / исключён». Вернувшийся в кооператив остаётся `active`.
 * Вход и своё у вышедшего остаются — документы, платежи, ход возврата взноса.
 */
export default {
  name: 'users: статус после завершённого выхода из кооператива',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      const soviet = SovietContract.contractName.production;
      const result = await dataSource.query(
        `
        WITH last_membership_action AS (
          SELECT DISTINCT ON (data ->> 'username')
            data ->> 'username' AS username,
            name
          FROM blockchain_actions
          WHERE account = $1
            AND receiver = $1
            AND name IN ('addpartcpnt', 'delpartcpnt')
            AND data ->> 'coopname' = $2
          ORDER BY data ->> 'username', block_num DESC, global_sequence::numeric DESC
        )
        UPDATE users
        SET status = 'blocked'
        FROM last_membership_action
        WHERE last_membership_action.name = 'delpartcpnt'
          AND users.username = last_membership_action.username
          AND users.status <> 'blocked'
        RETURNING users.username
        `,
        [soviet, config.coopname]
      );
      // UPDATE … RETURNING драйвер отдаёт парой [строки, число строк].
      const rows: Array<{ username: string }> = Array.isArray(result?.[0]) ? result[0] : result;
      logger.info(
        rows.length
          ? `Статус «принят» снят с вышедших: ${rows.map((r) => r.username).join(', ')}`
          : 'Вышедших пайщиков со статусом «принят» нет'
      );
      return true;
    } catch (e) {
      logger.error(`Статус после выхода не обновлён: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат 202610031230 не реализован: прежний статус вышедших пайщиков не хранится.');
    return false;
  },
};
