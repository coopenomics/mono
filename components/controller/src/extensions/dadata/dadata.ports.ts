/**
 * Порты контура, которые запрашивает расширение «DaData».
 *
 * Это его capability-заявка (ADR-16): что расширению вообще позволено просить
 * у кооператива. Расширению нужен только реестр поставщиков сведений об
 * организации — туда оно кладёт себя — и журнал.
 */
import { LOGGER_PORT, ORGANIZATION_LOOKUP_REGISTRY_PORT } from '@coopenomics/innercoop';

export const dadataPorts = {
  required: [
    LOGGER_PORT,
    ORGANIZATION_LOOKUP_REGISTRY_PORT,
  ],
  optional: [
  ],
};
