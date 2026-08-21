import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EduContributionStatus } from '../../domain/enums';
import { EdubridgeContributionEntity, EdubridgeTeacherAssignmentEntity, EdubridgeTeacherContractEntity } from '../entities';

@Injectable()
export class EdubridgeTeacherRepository {
  constructor(
    @InjectRepository(EdubridgeTeacherContractEntity) private readonly contracts: Repository<EdubridgeTeacherContractEntity>,
    @InjectRepository(EdubridgeTeacherAssignmentEntity) private readonly assignments: Repository<EdubridgeTeacherAssignmentEntity>,
    @InjectRepository(EdubridgeContributionEntity) private readonly contributions: Repository<EdubridgeContributionEntity>
  ) {}

  findContract(coopname: string, teacher: string): Promise<EdubridgeTeacherContractEntity | null> {
    return this.contracts.findOne({ where: { coopname, teacher_username: teacher } });
  }

  saveContract(data: Partial<EdubridgeTeacherContractEntity>): Promise<EdubridgeTeacherContractEntity> {
    return this.contracts.save(this.contracts.create(data));
  }

  listAssignments(coopname: string, filter: { teacher?: string } = {}): Promise<EdubridgeTeacherAssignmentEntity[]> {
    return this.assignments.find({ where: { coopname, ...(filter.teacher ? { teacher_username: filter.teacher } : {}) }, order: { created_at: 'DESC' } });
  }

  findAssignment(coopname: string, id: string): Promise<EdubridgeTeacherAssignmentEntity | null> {
    return this.assignments.findOne({ where: { coopname, id } });
  }

  createAssignment(data: Partial<EdubridgeTeacherAssignmentEntity>): EdubridgeTeacherAssignmentEntity {
    return this.assignments.create(data);
  }

  saveAssignment(a: EdubridgeTeacherAssignmentEntity): Promise<EdubridgeTeacherAssignmentEntity> {
    return this.assignments.save(a);
  }

  listContributions(coopname: string, filter: { teacher?: string; statuses?: EduContributionStatus[] } = {}): Promise<EdubridgeContributionEntity[]> {
    return this.contributions.find({
      where: {
        coopname,
        ...(filter.teacher ? { teacher_username: filter.teacher } : {}),
        ...(filter.statuses?.length ? { status: In(filter.statuses) } : {}),
      },
      order: { created_at: 'DESC' },
    });
  }

  findContribution(coopname: string, id: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ where: { coopname, id } });
  }

  findContributionByRidHash(ridHash: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ where: { rid_hash: ridHash.toLowerCase() } });
  }

  findContributionByProjectHash(hash: string): Promise<EdubridgeContributionEntity | null> {
    return this.contributions.findOne({ where: { council_project_hash: hash.toLowerCase() } });
  }

  createContribution(data: Partial<EdubridgeContributionEntity>): EdubridgeContributionEntity {
    return this.contributions.create(data);
  }

  saveContribution(c: EdubridgeContributionEntity): Promise<EdubridgeContributionEntity> {
    return this.contributions.save(c);
  }
}
