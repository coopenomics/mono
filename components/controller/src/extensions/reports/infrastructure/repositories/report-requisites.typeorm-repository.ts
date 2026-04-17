import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportRequisitesEntity } from '../entities/report-requisites.entity';
import type {
  ReportRequisitesRecord,
  ReportRequisitesRepository,
  UpsertReportRequisitesInput,
} from '../../domain/repositories/report-requisites.repository';

@Injectable()
export class ReportRequisitesTypeormRepository implements ReportRequisitesRepository {
  constructor(
    @InjectRepository(ReportRequisitesEntity)
    private readonly repository: Repository<ReportRequisitesEntity>
  ) {}

  async getByCoopname(coopname: string): Promise<ReportRequisitesRecord | null> {
    const entity = await this.repository.findOne({ where: { coopname } });
    return entity ? this.toRecord(entity) : null;
  }

  async upsert(input: UpsertReportRequisitesInput): Promise<ReportRequisitesRecord> {
    const existing = await this.repository.findOne({ where: { coopname: input.coopname } });
    if (existing) {
      const patch: Partial<ReportRequisitesEntity> = {};
      if (input.okved !== undefined) patch.okved = input.okved;
      if (input.okfs !== undefined) patch.okfs = input.okfs;
      if (input.okopf !== undefined) patch.okopf = input.okopf;
      if (input.oktmo !== undefined) patch.oktmo = input.oktmo;
      if (input.okpo !== undefined) patch.okpo = input.okpo;
      if (input.sfr_reg_number !== undefined) patch.sfr_reg_number = input.sfr_reg_number;
      if (input.chairman_position !== undefined) patch.chairman_position = input.chairman_position;
      if (input.signer_snils !== undefined) patch.signer_snils = input.signer_snils;
      if (input.signer_rep_doc !== undefined) patch.signer_rep_doc = input.signer_rep_doc;
      if (input.phone_override !== undefined) patch.phone_override = input.phone_override;
      if (input.address_override !== undefined) patch.address_override = input.address_override;
      patch.updated_by = input.updated_by;
      await this.repository.update({ coopname: input.coopname }, patch);
      const reloaded = await this.repository.findOne({ where: { coopname: input.coopname } });
      return this.toRecord(reloaded!);
    }
    const entity = this.repository.create({
      coopname: input.coopname,
      okved: input.okved ?? null,
      okfs: input.okfs ?? null,
      okopf: input.okopf ?? null,
      oktmo: input.oktmo ?? null,
      okpo: input.okpo ?? null,
      sfr_reg_number: input.sfr_reg_number ?? null,
      chairman_position: input.chairman_position ?? null,
      signer_snils: input.signer_snils ?? null,
      signer_rep_doc: input.signer_rep_doc ?? null,
      phone_override: input.phone_override ?? null,
      address_override: input.address_override ?? null,
      updated_by: input.updated_by,
    });
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  private toRecord(entity: ReportRequisitesEntity): ReportRequisitesRecord {
    return {
      coopname: entity.coopname,
      okved: entity.okved ?? null,
      okfs: entity.okfs ?? null,
      okopf: entity.okopf ?? null,
      oktmo: entity.oktmo ?? null,
      okpo: entity.okpo ?? null,
      sfr_reg_number: entity.sfr_reg_number ?? null,
      chairman_position: entity.chairman_position ?? null,
      signer_snils: entity.signer_snils ?? null,
      signer_rep_doc: entity.signer_rep_doc ?? null,
      phone_override: entity.phone_override ?? null,
      address_override: entity.address_override ?? null,
      updated_by: entity.updated_by,
      updated_at: entity.updated_at,
    };
  }
}
