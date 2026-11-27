import { Module } from '@nestjs/common';
import { CoreDemoResolver } from './core-demo.resolver';

@Module({ providers: [CoreDemoResolver] })
export class CoreDemoModule {}
