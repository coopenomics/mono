import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportRegistryService } from '../../domain/services/report-registry.service';
import { BuhotchGenerator } from '../generators/buhotch.generator';
import { Ndfl6Generator } from '../generators/ndfl6.generator';
import { RsvGenerator } from '../generators/rsv.generator';
import { PsvGenerator } from '../generators/psv.generator';
import { DusnGenerator } from '../generators/dusn.generator';
import { Fss4Generator } from '../generators/fss4.generator';
import { UvVznosyGenerator } from '../generators/uv-vznosy.generator';
import { UusnGenerator } from '../generators/uusn.generator';

@Injectable()
export class ReportInitService implements OnModuleInit {
  constructor(private readonly registry: ReportRegistryService) {}

  onModuleInit() {
    this.registry.register(new BuhotchGenerator());
    this.registry.register(new Ndfl6Generator());
    this.registry.register(new RsvGenerator());
    this.registry.register(new PsvGenerator());
    this.registry.register(new DusnGenerator());
    this.registry.register(new Fss4Generator());
    this.registry.register(new UvVznosyGenerator());
    this.registry.register(new UusnGenerator());
  }
}
