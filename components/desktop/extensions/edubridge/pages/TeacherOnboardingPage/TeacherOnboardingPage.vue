<template lang="pug">
EduOfferGate(
  :kind="Zeus.EduOfferKind.TEACHER"
  hint="Чтобы преподавать в кооперативе, подпишите оферту преподавателя. Договор участия в хозяйственной деятельности будет предложен следом, на столе преподавания."
  description="Оферта преподавателя определяет условия участия в хозяйственной деятельности кооператива: назначения на курсы, взнос результатами работы и расчёт по нему."
  offer-title="офертой преподавателя по ЦПП «Образование»"
  target-route="edubridge-assignments"
)
</template>

<script setup lang="ts">
import { Zeus } from '@coopenomics/sdk';
import { EduOfferGate } from '../../features/OfferGate';
</script>
