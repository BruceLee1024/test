/**
 * 图表样式配置
 * Chart Style Configuration
 */

export const CHART_STYLES = {
  // 网格样式
  grid: {
    strokeDasharray: '3 3',
    stroke: '#1e293b'
  },
  
  // 坐标轴样式
  axis: {
    stroke: '#64748b'
  },
  
  // 刻度样式
  tick: {
    fill: '#64748b',
    fontSize: 9,
    fontFamily: 'monospace'
  },
  
  // 小图表刻度样式
  tickSmall: {
    fill: '#64748b',
    fontSize: 8,
    fontFamily: 'monospace'
  },
  
  // Tooltip 样式
  tooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid #334155',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#fff'
  }
} as const;

// 图表颜色配置
export const CHART_COLORS = {
  forceDisplacement: '#3b82f6',  // 蓝色 - 力-位移
  forceTime: '#10b981',          // 绿色 - 力-时间
  stressStrain: '#f59e0b',       // 橙色 - 应力-应变
  hysteresisStress: '#a855f7',   // 紫色 - 滞回应力
  hysteresisForce: '#ec4899',    // 粉色 - 滞回力
  warning: '#f59e0b',            // 橙色 - 警告
  danger: '#ef4444',             // 红色 - 危险
  referenceLine: '#dc2626',      // 红色 - 参考线
  referenceLineBlue: '#3b82f6',  // 蓝色 - 参考线
} as const;

// 图表边距配置
export const CHART_MARGINS = {
  standard: { top: 5, right: 5, left: -25, bottom: 0 },
  hysteresis: { top: 5, right: 10, left: -15, bottom: 0 },
} as const;

// 背景网格样式
export const GRID_BACKGROUND_STYLE = {
  backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
  backgroundSize: '15px 15px'
} as const;
