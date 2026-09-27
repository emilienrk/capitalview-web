<script setup lang="ts">
import { Check, Circle } from 'lucide-vue-next'
import { computed } from 'vue'
import { PASSPHRASE_MIN_LENGTH, isPassphrase, passwordRules } from './passwordRules'

const props = defineProps<{ password: string }>()

const passphrase = computed(() => isPassphrase(props.password))
const rules = computed(() => passwordRules(props.password))
</script>

<template>
  <div class="space-y-2 text-sm">
    <p
      class="flex items-center gap-1.5"
      :class="passphrase ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted'"
    >
      <Check v-if="passphrase" class="w-3.5 h-3.5 shrink-0 text-primary" />
      <Circle v-else class="w-3.5 h-3.5 shrink-0" />
      <span>
        {{ PASSPHRASE_MIN_LENGTH }} caractères ou plus&nbsp;: une phrase suffit, sans autre règle
        <span class="sr-only">{{ passphrase ? ' : respecté' : ' : manquant' }}</span>
      </span>
    </p>
    <!-- Once the passphrase length is reached, the mix rules no longer apply. -->
    <div :class="passphrase && 'opacity-50'">
      <p class="text-text-muted dark:text-text-dark-muted">Ou bien&nbsp;:</p>
      <ul class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
        <li
          v-for="rule in rules"
          :key="rule.label"
          class="flex items-center gap-1.5"
          :class="rule.met ? 'text-text-main dark:text-text-dark-main' : 'text-text-muted dark:text-text-dark-muted'"
        >
          <Check v-if="rule.met" class="w-3.5 h-3.5 shrink-0 text-primary" />
          <Circle v-else class="w-3.5 h-3.5 shrink-0" />
          <span>{{ rule.label }}<span class="sr-only">{{ rule.met ? ' : respecté' : ' : manquant' }}</span></span>
        </li>
      </ul>
    </div>
  </div>
</template>
