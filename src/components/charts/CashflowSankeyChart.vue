<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useChartResize } from '@/composables/useChartResize'

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

const { chartRef, containerRef, canRenderChart, containerWidth, syncChartVisibilityAndSize } = useChartResize()
const isCompact = computed(() => containerWidth.value > 0 && containerWidth.value < 768)

const nodes = computed(() => {
  const names = new Set<string>()
  for (const link of props.links) {
    names.add(link.source)
    names.add(link.target)
  }
  return Array.from(names).map((name) => ({ name }))
})

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
  
  const savingsColor = '#10b981' // emerald-500
  const externalFundingColor = '#f59e0b' // amber-500
  
  const hiddenLabels = new Set(props.hideNodeLabels ?? [])

  const inflowGroups = new Map<string, number>()
  const outflowGroups = new Map<string, number>()
  
  for (const link of props.links) {
    const sourceGroup = getNodeGroup(link.source)
    const targetGroup = getNodeGroup(link.target)
    if (sourceGroup.startsWith('inflow:')) {
      inflowGroups.set(sourceGroup, (inflowGroups.get(sourceGroup) || 0) + link.value)
    }
    if (targetGroup.startsWith('outflow:')) {
      outflowGroups.set(targetGroup, (outflowGroups.get(targetGroup) || 0) + link.value)
    }
  }

  let maxInflow = 0
  for (const val of inflowGroups.values()) if (val > maxInflow) maxInflow = val
  let maxOutflow = 0
  for (const val of outflowGroups.values()) if (val > maxOutflow) maxOutflow = val

  function getIntensityColor(group: string, isWarm: boolean): string {
    const groupVal = isWarm ? (outflowGroups.get(group) || 0) : (inflowGroups.get(group) || 0)
    const maxVal = isWarm ? maxOutflow : maxInflow
    // Easing the ratio so small expenses aren't entirely faded out
    const linearRatio = maxVal > 0 ? groupVal / maxVal : 0.5
    const ratio = Math.pow(linearRatio, 0.7)

    if (isWarm) {
       // Warm: Yellow (50) -> Orange (25) -> Red (0) -> Crimson (345)
       const h = 50 - (55 * ratio)
       const hue = h < 0 ? h + 360 : h
       const s = 65 + (30 * ratio) 
       const l = props.isDark ? 65 - (15 * ratio) : 55 - (10 * ratio)
       return `hsl(${hue}, ${s}%, ${l}%)`
    } else {
       // Cold: Cyan (180) -> Azure (200) -> Blue (220) -> Indigo (240)
       const hue = 180 + (60 * ratio)
       const s = 65 + (30 * ratio) 
       const l = props.isDark ? 65 - (15 * ratio) : 60 - (10 * ratio)
       return `hsl(${hue}, ${s}%, ${l}%)`
    }
  }

  const nodeColorByName = new Map<string, string>()
  for (const node of nodes.value) {
    const group = getNodeGroup(node.name)

    if (group === 'hub:revenus') {
      nodeColorByName.set(node.name, props.isDark ? '#3b82f6' : '#2563eb')
      continue
    }
    if (group === 'hub:epargne') {
      nodeColorByName.set(node.name, savingsColor)
      continue
    }
    if (group === 'hub:external') {
      nodeColorByName.set(node.name, externalFundingColor)
      continue
    }
    if (group.startsWith('inflow:')) {
      nodeColorByName.set(node.name, getIntensityColor(group, false))
      continue
    }
    if (group.startsWith('outflow:')) {
      nodeColorByName.set(node.name, getIntensityColor(group, true))
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
      color = getIntensityColor(targetGroup, true)
    } else if (targetGroup === 'hub:revenus' && sourceGroup.startsWith('inflow:')) {
      color = getIntensityColor(sourceGroup, false)
    } else if (targetGroup === 'hub:epargne') {
      color = savingsColor
    } else if (sourceGroup === 'hub:external') {
      color = externalFundingColor
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
      confine: true,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        // Hub node ids — we never want to display them in tooltips
        const hubIds = new Set(['hub:revenus', 'hub:epargne', 'hub:external'])

        if (params?.dataType === 'edge') {
          const value = Number(params.data?.value || 0)
          const src: string = params.data.source
          const tgt: string = params.data.target
          // Pick whichever side isn't a hub; fallback to source
          const leafId = hubIds.has(src) ? tgt : src
          const leafLabel = getNodeLabel(leafId)
          return `<span style="font-weight:600">${leafLabel}</span><br/><span style="font-size:13px;font-weight:600">${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</span>`
        }

        // Node tooltip
        const nodeId = params?.name || ''
        // Hide hub nodes entirely
        if (hubIds.has(nodeId)) return ''
        const label = getNodeLabel(nodeId)
        if (!label) return ''
        const total = props.links
          .filter((l) => l.source === nodeId || l.target === nodeId)
          .reduce((sum, l) => sum + l.value, 0)
        const totalStr = total > 0
          ? `<br/><span style="font-size:13px;font-weight:600">${total.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</span>`
          : ''
        return `<span style="font-weight:600">${label}</span>${totalStr}`
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
  <div ref="containerRef" class="w-full h-80 sm:h-104" style="touch-action: pan-y;">
    <VChart
      v-if="canRenderChart"
      ref="chartRef"
      :option="option"
      autoresize
      @finished="handleChartReady"
    />
  </div>
</template>
