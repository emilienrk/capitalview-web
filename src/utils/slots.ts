import { Comment, Fragment, Text, type Slot, type VNode } from 'vue'

function rendersNothing(vnode: VNode): boolean {
  if (vnode.type === Comment) return true
  if (vnode.type === Text) return !String(vnode.children ?? '').trim()
  if (vnode.type === Fragment) return (vnode.children as VNode[]).every(rendersNothing)
  return false
}

/**
 * Whether a slot produces visible output. A slot holding only `v-if`s that are
 * all false still exists — it renders comment placeholders — so `$slots.x`
 * alone cannot decide whether to draw a wrapper around it.
 */
export function hasSlotContent(slot?: Slot): boolean {
  return !!slot && slot().some((vnode) => !rendersNothing(vnode))
}
