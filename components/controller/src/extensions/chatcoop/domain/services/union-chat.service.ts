import { Injectable, Logger, Inject } from '@nestjs/common';
import config from '~/config/config';
import { MatrixApiService } from '../../application/services/matrix-api.service';
import { UNION_CHAT_REPOSITORY, UnionChatRepository } from '../repositories/union-chat.repository';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import {
  ExtensionDomainRepository,
  EXTENSION_REPOSITORY,
} from '@coopenomics/extension-kit';
import { IConfig } from '../../chatcoop-extension.module';
import { OrganizationType } from '~/application/account/enum/organization-type.enum';
import { COOPERATIVE_VARS_PORT, type ICooperativeVarsPort } from '@coopenomics/innercoop';

@Injectable()
export class UnionChatService {
  private readonly logger = new Logger(UnionChatService.name);

  constructor(
    private readonly matrixApiService: MatrixApiService,
    @Inject(COOPERATIVE_VARS_PORT) private readonly cooperativeVars: ICooperativeVarsPort,
    @Inject(UNION_CHAT_REPOSITORY) private readonly unionChatRepository: UnionChatRepository,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>
  ) {}

  /**
   * Создает комнату связи кооператив ↔ союз и сохраняет запись.
   * Идемпотентность: проверяем по coopUsername.
   */
  async ensureUnionChat(account: AccountDomainEntity, matrixUserId: string): Promise<void> {
    try {
      if (!config.union?.is_unioned) {
        return;
      }

      const unionPersonId = config.union.union_person_id;
      const unionName = config.union.union_name || 'СПО РУСЬ';

      if (!unionPersonId) {
        this.logger.warn('union_person_id не задан, пропускаем создание комнаты союза');
        return;
      }

      // Только кооперативы (организационный аккаунт типа COOP). Для расширения на prodcoop добавить в список.
      const orgData = account.private_account?.organization_data;
      const allowedOrgTypes = new Set<string>([OrganizationType.COOP]);
      if (!orgData || !allowedOrgTypes.has(orgData.type)) {
        return;
      }

      const coopUsername = account.username;

      // Идемпотентность
      const existing = await this.unionChatRepository.findByCoopUsername(coopUsername);
      if (existing) {
        this.logger.debug(`Комната союза уже существует для ${coopUsername}, roomId=${existing.roomId}`);
        return;
      }

      const vars = await this.cooperativeVars.get();
      if (!vars) {
        this.logger.warn('vars не получены, пропускаем создание комнаты союза');
        return;
      }

      // Имя комнаты
      const roomName = `${orgData.short_name} & ${unionName}`;
      const topic = `Связь с представителем ${unionName}`;

      // Создаем комнату без шифрования, приватную
      const roomId = await this.matrixApiService.createRoom(roomName, topic, true, undefined, undefined, false);

      // Union-комната не добавляется в пространство кооператива, она существует отдельно
      // как независимая комната связи между кооперативом и союзом

      // Подключаем участников (admin автоматически становится членом как создатель комнаты)
      await this.matrixApiService.joinRoom(matrixUserId, roomId);
      await this.matrixApiService.joinRoom(unionPersonId, roomId);

      await this.unionChatRepository.create({
        coopUsername,
        matrixUserId,
        roomId,
        unionPersonId,
        unionName,
      });

      // Отправляем приветственное сообщение
      const coopDisplayName = orgData.short_name;
      const welcomeMessage = `Добро пожаловать в комнату связи между представителем кооператива ${coopDisplayName} и ${unionName}.`;

      await this.matrixApiService.sendMessage(roomId, welcomeMessage);

      this.logger.log(`Создана комната союза ${roomId} для ${coopUsername} и отправлено приветственное сообщение`);
    } catch (error) {
      this.logger.error(`Не удалось создать комнату союза для ${account.username}: ${error}`);
    }
  }
}
