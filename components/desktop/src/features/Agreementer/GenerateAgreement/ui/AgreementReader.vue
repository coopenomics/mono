<template lang="pug">
div(v-if="agreement")
  DocumentHtmlReader(:html="agreement.html")
</template>

<script setup lang="ts">
  import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
  const { info } = useSystemStore()

  import { useGenerateAgreement } from '../model';
  import { useSessionStore } from 'src/entities/Session';
  import { computed, onMounted } from 'vue';
  import { FailAlert } from 'src/shared/api';
  import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
  import { useAgreementStore } from 'src/entities/Agreement';
  import { SovietContract } from 'cooptypes';
  const session = useSessionStore();

  const { generateAgreement } = useGenerateAgreement();
  const agreementer = useAgreementStore()

  const agreement = computed(() => agreementer.generatedAgreements.find(el => el.meta.registry_id == props.agreement.draft_id))

  const props = defineProps({
    agreement: {
      type: Object as () => SovietContract.Tables.CoopAgreements.ICoopAgreement,
      required: true,
    },
  });

  onMounted(async () => {
    try {
      await generateAgreement(info.coopname, session.username, Number(props.agreement.draft_id));
    } catch(e: any){
      FailAlert(t('agreementer.agreementReader.generateError', { message: e.message }));
    }

  });
  </script>
