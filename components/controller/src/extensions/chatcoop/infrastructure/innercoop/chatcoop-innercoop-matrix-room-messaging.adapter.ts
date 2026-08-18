import { Injectable } from '@nestjs/common';
import type {
  InnerMatrixReplaceTextMessageInput,
  IMatrixRoomMessagingPort,
  InnerMatrixSendTextAndPinInput,
  InnerMatrixSendTextMessageInput,
  InnerMatrixUnpinAndRedactAnnouncementInput,
} from '@coopenomics/innercoop';
import { MatrixApiService } from '../../application/services/matrix-api.service';

@Injectable()
export class ChatcoopInnercoopMatrixRoomMessagingAdapter implements IMatrixRoomMessagingPort {
  constructor(private readonly matrixApi: MatrixApiService) {}

  async sendTextMessage(input: InnerMatrixSendTextMessageInput): Promise<string> {
    return this.matrixApi.sendMessage(input.matrixRoomId, input.plainTextBody);
  }

  async sendTextMessageAndPin(input: InnerMatrixSendTextAndPinInput): Promise<string> {
    return this.matrixApi.sendTextMessageAndPin(input.matrixRoomId, input.plainTextBody);
  }

  async replaceTextMessage(input: InnerMatrixReplaceTextMessageInput): Promise<void> {
    await this.matrixApi.replaceTextMessage(input.matrixRoomId, input.rootEventId, input.plainTextBody);
  }

  async unpinAndRedactAnnouncement(input: InnerMatrixUnpinAndRedactAnnouncementInput): Promise<void> {
    await this.matrixApi.unpinAndRedactRootMessage(input.matrixRoomId, input.rootEventId);
  }
}
