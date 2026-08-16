import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ZeroReportHeaderEditsInputDTO,
  ZeroReportOrganizationEditsInputDTO,
  ZeroReportSignerEditsInputDTO,
} from './zero-report-edits.dto';

/**
 * DTO уведомления об исчисленных суммах НДФЛ — зеркало `UvNdflEditsShape`.
 * От уведомлений по УСН и взносам отличается только суммой: она берётся из
 * удержаний с материальной помощи и правится бухгалтером, а не всегда ноль.
 */

@InputType('UvNdflPaymentEditsInput')
export class UvNdflPaymentEditsInputDTO {
  @Field(() => Int, {
    description: 'Сумма налога к перечислению за расчётный период, рублей',
  })
  @IsInt()
  @Min(0)
  amount!: number;
}

@InputType('UvNdflEditsInput')
export class UvNdflEditsInputDTO {
  @Field(() => ZeroReportHeaderEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportHeaderEditsInputDTO)
  header!: ZeroReportHeaderEditsInputDTO;

  @Field(() => ZeroReportOrganizationEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportOrganizationEditsInputDTO)
  organization!: ZeroReportOrganizationEditsInputDTO;

  @Field(() => ZeroReportSignerEditsInputDTO)
  @ValidateNested()
  @Type(() => ZeroReportSignerEditsInputDTO)
  signer!: ZeroReportSignerEditsInputDTO;

  @Field(() => UvNdflPaymentEditsInputDTO)
  @ValidateNested()
  @Type(() => UvNdflPaymentEditsInputDTO)
  payment!: UvNdflPaymentEditsInputDTO;
}
