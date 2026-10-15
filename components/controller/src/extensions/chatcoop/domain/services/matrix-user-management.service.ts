import { Inject, Injectable } from '@nestjs/common';
import { MatrixUserDomainEntity } from '../entities/matrix-user.entity';
import { MATRIX_USER_REPOSITORY, MatrixUserRepository } from '../repositories/matrix-user.repository';
import { DomainError } from '@coopenomics/extension-kit';

export interface CreateMatrixUserData {
  coopUsername: string;
  matrixUserId: string;
  matrixUsername: string;
}

@Injectable()
export class MatrixUserManagementService {
  constructor(@Inject(MATRIX_USER_REPOSITORY) private readonly matrixUserRepository: MatrixUserRepository) {}

  async createMatrixUser(data: CreateMatrixUserData): Promise<MatrixUserDomainEntity> {
    // Проверяем, существует ли уже пользователь
    const existingUser = await this.matrixUserRepository.findByCoopUsername(data.coopUsername);
    if (existingUser) {
      throw DomainError.internal('CHATCOOP_MATRIX_USER_ALREADY_EXISTS');
    }

    const matrixUser = await this.matrixUserRepository.create({
      coopUsername: data.coopUsername,
      matrixUserId: data.matrixUserId,
      matrixUsername: data.matrixUsername,
    });

    return matrixUser;
  }

  async getMatrixUserByCoopUsername(coopUsername: string): Promise<MatrixUserDomainEntity | null> {
    return this.matrixUserRepository.findByCoopUsername(coopUsername);
  }

  async getAllMatrixUsers(): Promise<MatrixUserDomainEntity[]> {
    return this.matrixUserRepository.findAll();
  }
}
