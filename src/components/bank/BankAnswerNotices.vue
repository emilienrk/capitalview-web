<script setup lang="ts">
/**
 * What the last answer did, and what went wrong, at the foot of the screen
 * rather than above the list: an answer given far down it, or put back by a
 * failure, is still said where it can be read.
 */
import { BaseAlert } from '@/components'
import type { AnswerNotice } from '@/composables/useBankAnswers'
import { RULES_PAGE } from '@/utils/cashflowTypes'

// A page that only writes, with nothing to say once saved, passes its errors alone.
const notice = defineModel<AnswerNotice | null>('notice', { default: null })
const error = defineModel<string | null>('error', { required: true })

defineEmits<{ undo: [] }>()
</script>

<template>
  <!-- The page scrolls as a whole, so nothing in its flow can stay in sight:
       fixed over the content column, clear of the sidebar. -->
  <div
    v-if="notice || error"
    class="fixed inset-x-4 lg:left-sidebar lg:right-0 lg:px-8 z-20 pointer-events-none"
    style="bottom: calc(1rem + env(safe-area-inset-bottom, 0px));"
  >
    <div class="mx-auto max-w-xl space-y-2 pointer-events-auto">
      <!-- Opaque under each alert, whose own tint would let the rows show through. -->
      <div v-if="notice" class="rounded-input bg-surface dark:bg-surface-dark shadow-modal">
        <BaseAlert variant="success" dismissible @dismiss="notice = null">
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
      </div>
      <div v-if="error" class="rounded-input bg-surface dark:bg-surface-dark shadow-modal">
        <BaseAlert variant="danger" dismissible @dismiss="error = null">{{ error }}</BaseAlert>
      </div>
    </div>
  </div>
</template>
