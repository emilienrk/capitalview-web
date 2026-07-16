<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useConfirm } from '@/composables/useConfirm'

const { confirmState, settle } = useConfirm()
</script>

<template>
  <BaseModal
    :open="confirmState.open"
    :title="confirmState.title"
    size="sm"
    @close="settle(false)"
  >
    <div class="flex items-start gap-3">
      <div
        :class="[
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
          confirmState.variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary',
        ]"
      >
        <TriangleAlert class="w-5 h-5" />
      </div>
      <p class="text-sm text-text-body dark:text-text-dark-body pt-1.5 whitespace-pre-line">
        {{ confirmState.message }}
      </p>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="settle(false)">
        {{ confirmState.cancelLabel }}
      </BaseButton>
      <BaseButton :variant="confirmState.variant === 'danger' ? 'danger' : 'primary'" @click="settle(true)">
        {{ confirmState.confirmLabel }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
