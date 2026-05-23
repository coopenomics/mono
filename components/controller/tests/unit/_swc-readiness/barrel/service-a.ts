import { Injectable } from '@nestjs/common';

@Injectable()
export class ServiceA {
  readonly id = 'service-a';
  greet(): string {
    return 'hello from ServiceA';
  }
}
