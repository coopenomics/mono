import { Inject, Injectable } from '@nestjs/common';
import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_TEACHER_CONTRACT_STORE } from '../../infrastructure/database/edubridge-stores';
import {
  COUNCIL_PORT,
  LOGGER_PORT,
  PROGRAM_AGREEMENT_PORT,
  ROLE_ASSIGNMENTS_PORT,
  type ICouncilPort,
  type ILoggerPort,
  type IProgramAgreementPort,
  type IRoleAssignmentsPort,
} from '@coopenomics/innercoop';
import { EDU_PARENT_AGREEMENT_TYPE, EDU_TEACHER_AGREEMENT_TYPE } from '../../constants/edubridge-agreement-ids';
import { EduContractStatus } from '../../domain/enums';
import { EdubridgeTeacherContractRecord } from '../../infrastructure/entities';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EDU_ADMIN_ROLE } from '../access/edubridge-access-matrix';
import type { IEdubridgeRoleFactsPort } from './edubridge-role-facts.port';
import type { EdubridgeRoleFacts } from './edubridge-roles.mapper';

/** Как долго верить номеру программы из реестра кооператива. */
const PROGRAM_ID_TTL_MS = 60_000;

/**
 * Факты о пайщике: подписана ли оферта ученика / преподавателя
 * (подпись программной оферты хранит ядро — `PROGRAM_AGREEMENT_PORT`), подписан
 * ли преподавателем договор УХД (зеркало `educontracts`, статус «ждёт
 * председателя» или «действует»), назначена ли роль администратора (общие назначения ролейя). Номер программы берётся из реестра
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
    @Inject(ROLE_ASSIGNMENTS_PORT)
    private readonly roleAssignments: IRoleAssignmentsPort,
    @Inject(EDUBRIDGE_TEACHER_CONTRACT_STORE)
    private readonly contracts: TableStore<EdubridgeTeacherContractRecord>
  ) {
    this.logger.setContext(EdubridgeRoleFactsAdapter.name);
  }

  async resolve(coopname: string, username: string): Promise<EdubridgeRoleFacts> {
    const [isLearner, hasTeacherOffer, contract, admin] = await Promise.all([
      this.hasProgramSignature(coopname, username, EDU_PARENT_AGREEMENT_TYPE),
      this.hasProgramSignature(coopname, username, EDU_TEACHER_AGREEMENT_TYPE),
      this.contracts.findOne({ coopname, teacher_username: username, status: oneOf([EduContractStatus.PENDING_APPROVAL, EduContractStatus.ACTIVE]) }),
      // Администратора назначает председатель на странице управления доступом.
      this.roleAssignments.rolesOf(EDUBRIDGE_EXTENSION_NAME, username),
    ]);
    return { isLearner, hasTeacherOffer, isTeacher: hasTeacherOffer && Boolean(contract), isAdmin: admin.includes(EDU_ADMIN_ROLE) };
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
