<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, SankeyChart, TooltipComponent])

interface SankeyLink {
  source: string
  target: string
  value: number
}

const props = defineProps<{
  links: SankeyLink[]
  nodeLabels?: Record<string, string>
  nodeGroups?: Record<string, string>
  hideNodeLabels?: string[]
  isDark?: boolean
}>()

const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const canRenderChart = ref(false)
const isCompact = ref(false)
let resizeObserver: ResizeObserver | null = null

function syncChartVisibilityAndSize(): void {
  const container = containerRef.value
  if (!container) return

  const hasSize = container.clientWidth > 0 && container.clientHeight > 0
  if (!hasSize) return

  isCompact.value = container.clientWidth < 768

  canRenderChart.value = true
  nextTick(() => {
    chartRef.value?.resize()
  })
}

onMounted(() => {
  syncChartVisibilityAndSize()

  resizeObserver = new ResizeObserver(() => {
    syncChartVisibilityAndSize()
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

const nodes = computed(() => {
  const names = new Set<string>()
  for (const link of props.links) {
    names.add(link.source)
    names.add(link.target)
  }
  return Array.from(names).map((name) => ({ name }))
})

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickColorByName(name: string, palette: string[]): string {
  return palette[hashString(name) % palette.length] as string
}

function getNodeLabel(nodeId: string): string {
  return props.nodeLabels?.[nodeId] ?? nodeId
}

function getNodeGroup(nodeId: string): string {
  return props.nodeGroups?.[nodeId] ?? nodeId
}

const option = computed(() => {
  const textColor = props.isDark ? '#cbd5e1' : '#334155'
  const tooltipBg = props.isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)'
  const tooltipBorder = props.isDark ? '#334155' : '#e2e8f0'
  const tooltipText = props.isDark ? '#f8fafc' : '#0f172a'
  const lineOpacity = props.isDark ? 0.38 : 0.3
  const coolPalette = ['#0284c7', '#0ea5e9', '#06b6d4', '#14b8a6', '#2563eb']
  const warmPalette = ['#ef4444', '#f97316', '#f59e0b', '#fb7185', '#dc2626']
  const savingsFlashColor = '#ff3fd4'
  const hiddenLabels = new Set(props.hideNodeLabels ?? [])

  const nodeColorByName = new Map<string, string>()
  for (const node of nodes.value) {
    const group = getNodeGroup(node.name)

    if (group === 'hub:revenus') {
      nodeColorByName.set(node.name, '#0284c7')
      continue
    }
    if (group === 'hub:epargne') {
      nodeColorByName.set(node.name, savingsFlashColor)
      continue
    }
    if (group === 'hub:external') {
      nodeColorByName.set(node.name, '#f97316')
      continue
    }
    if (group.startsWith('inflow:')) {
      nodeColorByName.set(node.name, pickColorByName(group, coolPalette))
      continue
    }
    if (group.startsWith('outflow:')) {
      nodeColorByName.set(node.name, pickColorByName(group, warmPalette))
      continue
    }
    nodeColorByName.set(node.name, props.isDark ? '#64748b' : '#94a3b8')
  }

  const sankeyNodes = nodes.value.map((node) => ({
    ...node,
    itemStyle: {
      color: nodeColorByName.get(node.name),
      borderWidth: 0,
    },
  }))

  const sankeyLinks = props.links.map((link) => {
    const sourceGroup = getNodeGroup(link.source)
    const targetGroup = getNodeGroup(link.target)
    let color = props.isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.4)'

    if (sourceGroup === 'hub:revenus' && targetGroup.startsWith('outflow:')) {
      color = pickColorByName(targetGroup, warmPalette)
    } else if (targetGroup === 'hub:revenus' && sourceGroup.startsWith('inflow:')) {
      color = pickColorByName(sourceGroup, coolPalette)
    } else if (targetGroup === 'hub:epargne') {
      color = savingsFlashColor
    } else if (sourceGroup === 'hub:external') {
      color = '#f97316'
    }

    return {
      ...link,
      lineStyle: {
        color,
        opacity: lineOpacity,
      },
    }
  })

  return {
    backgroundColor: 'transparent',
    animationDuration: 500,
    animationDurationUpdate: 350,
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        if (params?.data?.source && params?.data?.target) {
          const value = Number(params.data.value || 0)
          const sourceLabel = getNodeLabel(params.data.source)
          const targetLabel = getNodeLabel(params.data.target)
          return `${sourceLabel} • ${targetLabel}<br/><strong>${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</strong>`
        }
        return String(getNodeLabel(params?.name || ''))
      },
    },
    series: [
      {
        type: 'sankey',
        left: isCompact.value ? 6 : 12,
        right: isCompact.value ? 6 : 12,
        top: isCompact.value ? 6 : 10,
        bottom: isCompact.value ? 6 : 10,
        nodeWidth: isCompact.value ? 12 : 14,
        nodeGap: isCompact.value ? 10 : 12,
        draggable: false,
        nodeAlign: 'justify',
        emphasis: {
          focus: 'none',
        },
        lineStyle: {
          color: 'source',
          curveness: 0.38,
          opacity: lineOpacity,
        },
        levels: [
          {
            depth: 0,
            label: {
              position: 'inside',
              align: 'left',
              verticalAlign: 'middle',
              padding: [0, 0, 0, 12],
            },
          },
          {
            depth: 1,
            label: {
              show: false,
            },
          },
          {
            depth: 2,
            label: {
              position: 'inside',
              align: 'right',
              verticalAlign: 'middle',
              padding: [0, 12, 0, 0],
            },
          },
        ],
        label: {
          position: isCompact.value ? 'inside' : 'right',
          distance: isCompact.value ? 0 : 6,
          color: textColor,
          fontSize: isCompact.value ? 10 : 11,
          overflow: 'truncate',
          width: isCompact.value ? 76 : 120,
          formatter: (params: { name?: string }) => {
            const nodeId = params?.name ?? ''
            if (!nodeId || hiddenLabels.has(nodeId)) return ''
            return getNodeLabel(nodeId)
          },
        },
        itemStyle: {
          borderWidth: 0,
        },
        data: sankeyNodes,
        links: sankeyLinks,
      },
    ],
  }
})

function handleChartReady(): void {
  syncChartVisibilityAndSize()
}
</script>

<template>
  <div ref="containerRef" class="w-full h-80 sm:h-104">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      autoresize
      @finished="handleChartReady"
    />
  </div>
</template>
