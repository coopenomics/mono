import { Inject, Injectable } from '@nestjs/common';
import { AgendaWithDocumentsDTO } from '../dto/agenda-with-documents.dto';
import { AgendaInteractor } from '../interactors/agenda.interactor';
import { UserCertificateDomainPort, USER_CERTIFICATE_DOMAIN_PORT } from '~/domain/user/ports/user-certificate-domain.port';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import config from '~/config/config';

@Injectable()
export class AgendaService {
  constructor(
    private readonly agendaInteractor: AgendaInteractor,
    @Inject(USER_CERTIFICATE_DOMAIN_PORT) private readonly userCertificateDomainPort: UserCertificateDomainPort,
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort
  ) {}

  public async getAgenda(): Promise<AgendaWithDocumentsDTO[]> {
    const agenda = await this.agendaInteractor.getAgenda();

    // Состав совета (`soviet`) дёргаем один раз — фронту нужен порог консенсуса.
    // Считаем всех членов совета (как контрактный get_members_count = members.size()).
    const boards = await this.sovietBlockchainPort.getBoards(config.coopname);
    const councilMembersCount = boards.find((b) => b.type === 'soviet')?.members.length ?? 0;

    // Обрабатываем каждый элемент повестки дня
    const processedAgenda = await Promise.all(
      agenda.map(async (item) => {
        // Получаем сертификат создателя решения
        const usernameCertificate = await this.userCertificateDomainPort.getCertificateByUsername(item.table.username);

        // Получаем сертификаты для голосовавших "за"
        const votesForCertificates: UserCertificateDomainInterface[] = [];
        for (const username of item.table.votes_for) {
          const certificate = await this.userCertificateDomainPort.getCertificateByUsername(username);
          if (certificate) {
            votesForCertificates.push(certificate);
          }
        }

        // Получаем сертификаты для голосовавших "против"
        const votesAgainstCertificates: UserCertificateDomainInterface[] = [];
        for (const username of item.table.votes_against) {
          const certificate = await this.userCertificateDomainPort.getCertificateByUsername(username);
          if (certificate) {
            votesAgainstCertificates.push(certificate);
          }
        }

        return new AgendaWithDocumentsDTO(
          item,
          usernameCertificate,
          votesForCertificates,
          votesAgainstCertificates,
          councilMembersCount
        );
      })
    );

    return processedAgenda;
  }

  /**
   * Возвращает ОДИН пункт повестки по хэшу документа-заявления (или null, если он
   * ещё не проиндексирован парсером). Используется сразу после публикации
   * свободного решения, чтобы фронт показал созданный вопрос немедленно.
   */
  public async getAgendaItemByHash(hash: string): Promise<AgendaWithDocumentsDTO | null> {
    const item = await this.agendaInteractor.getAgendaItemByHash(config.coopname, hash);
    if (!item) return null;

    const boards = await this.sovietBlockchainPort.getBoards(config.coopname);
    const councilMembersCount = boards.find((b) => b.type === 'soviet')?.members.length ?? 0;

    const usernameCertificate = await this.userCertificateDomainPort.getCertificateByUsername(item.table.username);

    // Только что созданный вопрос ещё без голосов — сертификаты голосовавших пусты.
    return new AgendaWithDocumentsDTO(item, usernameCertificate, [], [], councilMembersCount);
  }
}
