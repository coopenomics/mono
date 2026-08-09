import { OnModuleInit, Injectable } from '@nestjs/common';
import { z, type ZodObject } from 'zod';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';

@Injectable()
export abstract class BaseExtensionModule implements OnModuleInit {
  abstract name: string;
  abstract extension: ExtensionDomainEntity<any>;
  public configSchemas: ZodObject<any> = z.object({});
  abstract defaultConfig: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onModuleInit() {}

  abstract initialize(): Promise<void>;
}
