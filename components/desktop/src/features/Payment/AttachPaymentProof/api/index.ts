import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type IUploadPaymentProofInput = Mutations.Gateway.UploadPaymentProof.IInput['data'];
export type IPaymentFile =
  Queries.Gateway.PaymentProofs.IOutput[typeof Queries.Gateway.PaymentProofs.name][number];

async function uploadPaymentProof(data: IUploadPaymentProofInput): Promise<IPaymentFile> {
  const { [Mutations.Gateway.UploadPaymentProof.name]: result } = await client.Mutation(
    Mutations.Gateway.UploadPaymentProof.mutation,
    { variables: { data } },
  );
  return result;
}

async function loadPaymentProofs(coopname: string, payment_hash: string): Promise<IPaymentFile[]> {
  const { [Queries.Gateway.PaymentProofs.name]: result } = await client.Query(
    Queries.Gateway.PaymentProofs.query,
    { variables: { coopname, payment_hash } },
  );
  return result;
}

// Списочные запросы отдают файлы без read_url (он короткоживущий) — свежий URL
// запрашивается по id в момент клика.
async function getPaymentFileReadUrl(id: number): Promise<string | undefined> {
  const { [Queries.Gateway.PaymentFile.name]: result } = await client.Query(
    Queries.Gateway.PaymentFile.query,
    { variables: { id } },
  );
  return result.read_url ?? undefined;
}

export const api = {
  uploadPaymentProof,
  loadPaymentProofs,
  getPaymentFileReadUrl,
};
