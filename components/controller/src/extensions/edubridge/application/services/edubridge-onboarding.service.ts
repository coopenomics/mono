import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  COUNCIL_PORT,
  LOGGER_PORT,
  PROGRAM_AGREEMENT_PORT,
  type ICouncilPort,
  type ILoggerPort,
  type IProgramAgreementPort,
  type ISignedDocument,
} from '@coopenomics/innercoop';
import {
  EDU_PARENT_AGREEMENT_TYPE,
  EDU_PARENT_OFFER_REGISTRY_ID,
  EDU_TEACHER_AGREEMENT_TYPE,
  EDU_TEACHER_OFFER_REGISTRY_ID,
} from '../../constants/edubridge-agreement-ids';
import { EdubridgeConfigHolder } from '../config/edubridge-config.holder';
import { EduOfferKind, EduOfferStateDTO, EduOnboardingSource, EduOnboardingStateDTO } from '../dto/edu-onboarding.dto';

const OFFERS: Record<EduOfferKind, { type: string; registryId: number; human: string }> = {
  [EduOfferKind.PARENT]: { type: EDU_PARENT_AGREEMENT_TYPE, registryId: EDU_PARENT_OFFER_REGISTRY_ID, human: 'родителя-слушателя' },
  [EduOfferKind.TEACHER]: { type: EDU_TEACHER_AGREEMENT_TYPE, registryId: EDU_TEACHER_OFFER_REGISTRY_ID, human: 'преподавателя' },
};

/**
 * L3 — подпись оферты со стола: пайщик, вступивший без выбора программы
 * «Обучение»/«Преподавание» (или вступивший по одной и решивший добавить
 * вторую), подписывает оферту здесь. Подпись программной оферты хранит ядро
 * (`wallet::signagree`), приложение лишь находит программу по виду соглашения.
 */
@Injectable()
export class EdubridgeOnboardingService {
  constructor(
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Inject(PROGRAM_AGREEMENT_PORT) private readonly programAgreements: IProgramAgreementPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly config: EdubridgeConfigHolder
  ) {
    this.logger.setContext(EdubridgeOnboardingService.name);
  }

  async getState(coopname: string, username: string): Promise<EduOnboardingStateDTO> {
    const [parent, teacher] = await Promise.all([
      this.offerState(coopname, username, EduOfferKind.PARENT),
      this.offerState(coopname, username, EduOfferKind.TEACHER),
    ]);
    return { parent, teacher };
  }

  async signOffer(coopname: string, username: string, kind: EduOfferKind, document: ISignedDocument): Promise<EduOnboardingStateDTO> {
    const offer = OFFERS[kind];
    if (!(await this.config.load()).coopAcceptance.accepted) {
      throw new BadRequestException('ЦПП «Образование» ещё не принята советом кооператива: подписание оферты невозможно');
    }
    const programId = await this.programId(coopname, offer.type);
    if (programId <= 0) {
      throw new BadRequestException(`Программа ЦПП «Образование» (${offer.human}) не открыта в кооперативе`);
    }
    const programs = await this.council.getPrograms(coopname);
    const program = programs.find((p) => Number(p.id) === programId);
    if (!program) throw new BadRequestException(`Программа ${programId} не найдена в кооперативе ${coopname}`);

    this.logger.info(`[EDU.L3] подпись оферты ${offer.human}: ${coopname}/${username} program_id=${programId} draft_id=${program.draft_id}`);
    await this.programAgreements.signProgramAgreement({
      coopname,
      username,
      program_id: programId,
      draft_id: Number(program.draft_id),
      document,
    });
    return this.getState(coopname, username);
  }

  private async programId(coopname: string, type: string): Promise<number> {
    const coagreement = await this.council.getCoagreement(coopname, type);
    return coagreement ? Number(coagreement.program_id) : 0;
  }

  private async offerState(coopname: string, username: string, kind: EduOfferKind): Promise<EduOfferStateDTO> {
    const offer = OFFERS[kind];
    const base = { kind, registry_id: offer.registryId };
    if (!(await this.config.load()).coopAcceptance.accepted) {
      return { ...base, requires_gate: false, source: EduOnboardingSource.NOT_CONFIGURED };
    }
    const programId = await this.programId(coopname, offer.type);
    if (programId <= 0) return { ...base, requires_gate: false, source: EduOnboardingSource.NOT_CONFIGURED };
    const signature = await this.programAgreements.findProgramSignature(coopname, username, programId);
    if (signature) {
      return { ...base, requires_gate: false, source: EduOnboardingSource.AGREEMENT_SIGNED, signed_at: signature.signed_at ? String(signature.signed_at) : undefined };
    }
    return { ...base, requires_gate: true, source: EduOnboardingSource.GATE_REQUIRED };
  }
}
