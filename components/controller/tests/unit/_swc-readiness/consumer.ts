import { Injectable } from '@nestjs/common';
import { ServiceA } from './barrel';

@Injectable()
export class ServiceB {
  constructor(private readonly a: ServiceA) {}
  delegate(): string {
    return this.a.greet();
  }
}
