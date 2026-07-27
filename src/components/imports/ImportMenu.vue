<script setup lang="ts">
import { ChevronDown, Upload } from 'lucide-vue-next'
import { ref, type Component } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

export interface ImportMenuItem {
  key: string
  label: string
  icon: Component
}

interface Props {
  items: ImportMenuItem[]
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Importer',
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)

function choose(key: string): void {
  open.value = false
  emit('select', key)
}
</script>

<template>
  <div class="relative">
    <BaseButton variant="outline" :size="props.size" :disabled="props.disabled" @click.stop="open = !open">
      <Upload :class="props.size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'" />
      <span class="hidden sm:inline">{{ props.label }}</span>
      <ChevronDown class="w-3 h-3 ml-1" />
    </BaseButton>

    <!-- Overlay to close on outside click -->
    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

    <!-- Dropdown menu -->
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 z-50 bg-surface dark:bg-surface-dark border border-surface-border dark:border-surface-dark-border rounded-primary shadow-card min-w-45 overflow-hidden"
    >
      <button
        v-for="item in props.items"
        :key="item.key"
        class="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-text-body dark:text-text-dark-body hover:bg-background-subtle dark:hover:bg-background-dark-subtle transition-colors"
        @click.stop="choose(item.key)"
      >
        <component :is="item.icon" class="w-4 h-4 text-text-muted dark:text-text-dark-muted shrink-0" />
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
