import { Resolver, Mutation, Args, ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { IsString, IsArray } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import { COOPLACE_BLOCKCHAIN_PORT, type CooplaceBlockchainPort } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { config } from '~/config';

@InputType('CreateShipmentInput')
export class CreateShipmentInputDTO {
  @Field(() => String)
  @IsString()
  hash!: string;

  @Field(() => String)
  @IsString()
  driver_username!: string;

  @Field(() => String)
  @IsString()
  source_braname!: string;

  @Field(() => String)
  @IsString()
  destination_braname!: string;

  @Field(() => [String])
  @IsArray()
  request_hashes!: string[];

  @Field(() => SignedDigitalDocumentInputDTO)
  transport_act!: SignedDigitalDocumentInputDTO;
}

@InputType('SignShipmentInput')
export class SignShipmentInputDTO {
  @Field(() => String)
  @IsString()
  hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}

@Resolver()
export class ShipmentResolver {
  constructor(
    @Inject(COOPLACE_BLOCKCHAIN_PORT)
    private readonly blockchainPort: CooplaceBlockchainPort,
  ) {}

  @Mutation(() => TransactionDTO, {
    name: 'createShipment',
    description: 'Создать перевозку (КУ отправителя)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createShipment(
    @Args('data') data: CreateShipmentInputDTO,
  ): Promise<TransactionDTO> {
    const doc: Record<string, unknown> = { ...(data.transport_act as any) };
    doc.meta = JSON.stringify(doc.meta);
    return (this.blockchainPort as any).createShipment?.({
      coopname: config.coopname,
      ...data,
      transport_act_sender: doc,
    }) as any;
  }

  @Mutation(() => TransactionDTO, {
    name: 'signShipmentByDriver',
    description: 'Подпись водителя на перевозке',
  })
  @UseGuards(GqlJwtAuthGuard)
  async signShipmentByDriver(
    @Args('data') data: SignShipmentInputDTO,
  ): Promise<TransactionDTO> {
    const doc: Record<string, unknown> = { ...(data.document as any) };
    doc.meta = JSON.stringify(doc.meta);
    return (this.blockchainPort as any).signByDriver?.({
      coopname: config.coopname,
      hash: data.hash,
      transport_act_driver: doc,
    }) as any;
  }

  @Mutation(() => TransactionDTO, {
    name: 'shipmentArrived',
    description: 'Водитель отмечает прибытие',
  })
  @UseGuards(GqlJwtAuthGuard)
  async shipmentArrived(
    @Args('data') data: SignShipmentInputDTO,
  ): Promise<TransactionDTO> {
    const doc: Record<string, unknown> = { ...(data.document as any) };
    doc.meta = JSON.stringify(doc.meta);
    return (this.blockchainPort as any).arrived?.({
      coopname: config.coopname,
      hash: data.hash,
      transport_act_delivery: doc,
    }) as any;
  }

  @Mutation(() => TransactionDTO, {
    name: 'receiveShipment',
    description: 'Приём перевозки на складе КУ получателя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async receiveShipment(
    @Args('data') data: SignShipmentInputDTO,
  ): Promise<TransactionDTO> {
    const doc: Record<string, unknown> = { ...(data.document as any) };
    doc.meta = JSON.stringify(doc.meta);
    return (this.blockchainPort as any).receiveShipment?.({
      coopname: config.coopname,
      hash: data.hash,
      warehouse_receipt_act: doc,
    }) as any;
  }
}
