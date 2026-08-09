import { Injectable } from '@nestjs/common';
import { DesktopDTO } from '../dto/desktop.dto';
import {
  DesktopDomainInteractor,
  type IDesktopRequester,
} from '../interactors/desktop.interactor';

@Injectable()
export class DesktopService {
  constructor(private readonly desktopDomainInteractor: DesktopDomainInteractor) {}

  public async getDesktop(requester?: IDesktopRequester): Promise<DesktopDTO> {
    const desktop = await this.desktopDomainInteractor.getDesktop(requester);

    return new DesktopDTO(desktop);
  }
}
