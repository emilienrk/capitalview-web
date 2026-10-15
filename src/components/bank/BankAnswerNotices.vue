<script setup lang="ts">
/**
 * What the last answer did, and what went wrong, above a list of questions.
 * Held at the top of the page while it scrolls: an answer given far down the
 * list, or put back by a failure, is still said where it can be read.
 */
import { BaseAlert } from '@/components'
import type { AnswerNotice } from '@/composables/useBankAnswers'
import { RULES_PAGE } from '@/utils/cashflowTypes'

const notice = defineModel<AnswerNotice | null>('notice', { required: true })
const error = defineModel<string | null>('error', { required: true })

defineEmits<{ undo: [] }>()
</script>

<template>
  <!-- Opaque behind the alerts, whose own tint lets the rows show through. -->
  <div v-if="notice || error" class="sticky top-0 z-10 -mt-2 pt-2 bg-background dark:bg-background-dark">
    <BaseAlert v-if="notice" variant="success" dismissible class="mb-3" @dismiss="notice = null">
      {{ notice.message }}
      <template v-if="notice.ruleId">
        Règle créée, dans <router-link :to="RULES_PAGE" class="font-medium underline">Règles de tri</router-link>.
      </template>
      <!-- Never silent: a rule given from an answer, or a choice by hand, comes before a rule written by hand. -->
      <template v-if="notice.outranked">
        {{ notice.ruleId ? 'Pour ce libellé, elle' : 'Ce choix' }} passe avant la règle {{ notice.outranked }}.
      </template>
      <button v-if="!notice.final" type="button" class="ml-2 font-medium underline" @click="$emit('undo')">Annuler</button>
    </BaseAlert>
    <BaseAlert v-if="error" variant="danger" dismissible class="mb-3" @dismiss="error = null">{{ error }}</BaseAlert>
  </div>
</template>
