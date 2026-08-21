import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  COUNCIL_PORT,
  LOGGER_PORT,
  PROGRAM_AGREEMENT_PORT,
  type ICouncilPort,
  type ILoggerPort,
  type IProgramAgreementPort,
} from '@coopenomics/innercoop';
import { EDU_PARENT_AGREEMENT_TYPE, EDU_TEACHER_AGREEMENT_TYPE } from '../../constants/edubridge-agreement-ids';
import { EdubridgeAdminEntity } from '../../infrastructure/entities';
import type { IEdubridgeRoleFactsPort } from './edubridge-role-facts.port';
import type { EdubridgeRoleFacts } from './edubridge-roles.mapper';

/** Как долго верить номеру программы из реестра кооператива. */
const PROGRAM_ID_TTL_MS = 60_000;

/**
 * Факты о пайщике: подписана ли оферта родителя-слушателя / преподавателя
 * (подпись программной оферты хранит ядро — `PROGRAM_AGREEMENT_PORT`), назначен
 * ли администратором (таблица расширения). Номер программы берётся из реестра
 * кооператива по виду соглашения — как у Стола заказов; пока программа не
 * открыта, подписи быть не может.
 */
@Injectable()
export class EdubridgeRoleFactsAdapter implements IEdubridgeRoleFactsPort {
  private readonly programIds = new Map<string, { id: number; at: number }>();

  constructor(
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Inject(PROGRAM_AGREEMENT_PORT) private readonly programAgreements: IProgramAgreementPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @InjectRepository(EdubridgeAdminEntity) private readonly admins: Repository<EdubridgeAdminEntity>
  ) {
    this.logger.setContext(EdubridgeRoleFactsAdapter.name);
  }

  async resolve(coopname: string, username: string): Promise<EdubridgeRoleFacts> {
    const [isLearner, isTeacher, admin] = await Promise.all([
      this.hasProgramSignature(coopname, username, EDU_PARENT_AGREEMENT_TYPE),
      this.hasProgramSignature(coopname, username, EDU_TEACHER_AGREEMENT_TYPE),
      this.admins.findOne({ where: { coopname, username } }),
    ]);
    return { isLearner, isTeacher, isAdmin: Boolean(admin) };
  }

  private async programId(coopname: string, agreementType: string): Promise<number> {
    const cached = this.programIds.get(agreementType);
    if (cached && Date.now() - cached.at < PROGRAM_ID_TTL_MS) return cached.id;
    const coagreement = await this.council.getCoagreement(coopname, agreementType);
    const id = coagreement ? Number(coagreement.program_id) : 0;
    if (id > 0) this.programIds.set(agreementType, { id, at: Date.now() });
    return id;
  }

  private async hasProgramSignature(coopname: string, username: string, agreementType: string): Promise<boolean> {
    try {
      const id = await this.programId(coopname, agreementType);
      if (id <= 0) return false;
      const signature = await this.programAgreements.findProgramSignature(coopname, username, id);
      return Boolean(signature);
    } catch (e) {
      this.logger.warn(`Не удалось проверить подпись ${agreementType} для ${username}: ${(e as Error)?.message ?? e}`);
      return false;
    }
  }
}
