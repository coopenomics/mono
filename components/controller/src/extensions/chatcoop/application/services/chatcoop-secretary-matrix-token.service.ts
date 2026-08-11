import { Injectable, Inject, Logger } from '@nestjs/common';
import { MatrixApiService } from './matrix-api.service';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateRepository,
} from '../../domain/repositories/chatcoop-state.repository';
import { SECRET_CIPHER_PORT, type ISecretCipherPort } from '@coopenomics/innercoop';

const SECRETARY_TOKEN_EXPIRY_MS = 23 * 60 * 60 * 1000;

/**
 * Кэшированный Matrix access token сервисного аккаунта секретаря (чтение истории комнат, отправка от имени бота).
 */
@Injectable()
export class ChatCoopSecretaryMatrixTokenService {
  private readonly logger = new Logger(ChatCoopSecretaryMatrixTokenService.name);
  private cachedToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    @Inject(CHATCOOP_STATE_REPOSITORY) private readonly chatcoopState: ChatcoopStateRepository,
    private readonly matrixApiService: MatrixApiService,
    @Inject(SECRET_CIPHER_PORT) private readonly secretCipher: ISecretCipherPort
  ) {}

  async getAccessToken(): Promise<string | null> {
    if (this.cachedToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.cachedToken;
    }

    const st = await this.chatcoopState.getSingleton();
    const encryptedPassword = st.secretaryPasswordEncrypted;
    const matrixUserId = st.secretaryMatrixUserId;
    if (!matrixUserId || !encryptedPassword) {
      return null;
    }

    try {
      const password = this.secretCipher.decrypt(encryptedPassword);
      const username = String(matrixUserId).replace(/^@/, '').split(':')[0];
      const loginResponse = await this.matrixApiService.loginUser(username, password);
      this.cachedToken = loginResponse.access_token;
      this.tokenExpiry = new Date(Date.now() + SECRETARY_TOKEN_EXPIRY_MS);
      return this.cachedToken;
    } catch (error) {
      this.logger.warn(`Не удалось войти секретарём в Matrix: ${error}`);
      return null;
    }
  }
}
