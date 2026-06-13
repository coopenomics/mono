import { sendGET, sendPOST } from 'src/shared/api/axios';
import type { ICapabilitySet, ICapabilitySetAssignment } from '../model';

// auth-v2 (CoopID) эндпоинты — REST (как coop/certificate), токен прикрепляет sendGET/sendPOST.
async function getCapabilitySets(): Promise<ICapabilitySet[]> {
  return (await sendGET('/coop/capability-sets')) as ICapabilitySet[];
}

async function getParticipantSets(username: string): Promise<ICapabilitySetAssignment[]> {
  return (await sendGET(`/coop/capability-sets/participant/${username}`)) as ICapabilitySetAssignment[];
}

async function assignSet(data: { username: string; setKey: string; expiresAt?: string | null }): Promise<void> {
  await sendPOST('/coop/capability-sets/assign', data);
}

async function revokeSet(data: { username: string; setKey: string }): Promise<void> {
  await sendPOST('/coop/capability-sets/revoke', data);
}

export const api = { getCapabilitySets, getParticipantSets, assignSet, revokeSet };
