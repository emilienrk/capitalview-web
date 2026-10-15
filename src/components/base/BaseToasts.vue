<script setup lang="ts">
/**
 * The toasts `useToast` holds, at the foot of the screen: feedback on an
 * action stays in sight wherever the page was scrolled when it was given.
 */
import BaseAlert from '@/components/base/BaseAlert.vue'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss, pause, resume, act } = useToast()
</script>

<template>
  <!-- The page scrolls as a whole, so nothing in its flow can stay in sight:
       fixed over the content column, clear of the sidebar. -->
  <div
    class="fixed inset-x-4 lg:left-sidebar lg:right-0 lg:px-8 z-20 pointer-events-none"
    style="bottom: calc(1rem + env(safe-area-inset-bottom, 0px));"
  >
    <TransitionGroup
      tag="div"
      class="mx-auto max-w-xl space-y-2"
      leave-active-class="transition-opacity duration-150 ease-out"
      leave-to-class="opacity-0"
    >
      <!-- Opaque under each alert, whose own tint would let the page show through. -->
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="rounded-input bg-surface dark:bg-surface-dark shadow-modal pointer-events-auto"
        @pointerenter="pause(toast.id)"
        @pointerleave="resume(toast.id)"
        @focusin="pause(toast.id)"
        @focusout="resume(toast.id)"
      >
        <BaseAlert :variant="toast.variant" dismissible @dismiss="dismiss(toast.id)">
          <template v-for="(part, index) in toast.parts" :key="index">
            <template v-if="typeof part === 'string'">{{ part }}</template>
            <router-link v-else :to="part.to" class="font-medium underline">{{ part.label }}</router-link>
          </template>
          <button v-if="toast.action" type="button" class="ml-2 font-medium underline" @click="act(toast)">
            {{ toast.action.label }}
          </button>
        </BaseAlert>
      </div>
    </TransitionGroup>
  </div>
</template>
