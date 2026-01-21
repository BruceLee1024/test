/**
 * 图表数据处理工具函数
 * Chart Data Processing Utilities
 */

import { DataPoint } from '../../types';

/**
 * 图表数据统计信息
 */
export interface ChartStats {
  peakStress: number;
  peakLoad: number;
  peakStrain: number;
  currentStress: number;
  energy: number;
}

/**
 * 转换后的图表数据点
 */
export interface ChartDataPoint extends DataPoint {
  strainPercent: number;  // 千分比 ‰
  displacement: number;   // 位移 mm
  index: number;
}

/**
 * 计算峰值和统计信息
 */
export function calculateChartStats(data: DataPoint[]): ChartStats {
  if (data.length === 0) {
    return { peakStress: 0, peakLoad: 0, peakStrain: 0, currentStress: 0, energy: 0 };
  }
  
  let peakStress = 0;
  let peakLoad = 0;
  let peakStrain = 0;
  let energy = 0;
  
  for (let i = 0; i < data.length; i++) {
    if (data[i].stress > peakStress) {
      peakStress = data[i].stress;
      peakLoad = data[i].load;
      peakStrain = data[i].strain;
    }
    
    // 计算能量（应力-应变曲线下面积）
    if (i > 0) {
      energy += (data[i].stress + data[i - 1].stress) / 2 * (data[i].strain - data[i - 1].strain);
    }
  }
  
  return {
    peakStress,
    peakLoad,
    peakStrain,
    currentStress: data[data.length - 1].stress,
    energy: energy * 1000 // kJ/m³
  };
}

/**
 * 转换数据点为图表数据
 */
export function transformChartData(data: DataPoint[], specimenHeight: number): ChartDataPoint[] {
  return data.map((d, index) => ({
    ...d,
    strainPercent: d.strain * 1000, // 转换为千分比 ‰
    displacement: d.strain * specimenHeight, // 计算位移
    index,
  }));
}

/**
 * 检测滞回循环数量
 */
export function detectCycleCount(data: DataPoint[]): number {
  if (data.length < 10) return 0;
  
  let count = 0;
  let isLoading = true;
  
  for (let i = 1; i < data.length; i++) {
    const prevStress = data[i - 1].stress;
    const currStress = data[i].stress;
    
    if (isLoading && currStress < prevStress - 0.5) {
      isLoading = false;
    } else if (!isLoading && currStress > prevStress + 0.5) {
      count++;
      isLoading = true;
    }
  }
  
  return count;
}

/**
 * 根据当前状态获取图表颜色
 */
export function getChartColor(
  currentStress: number,
  peakStress: number,
  maxStress: number
): string {
  const isNearPeak = currentStress > maxStress * 0.9;
  const isPastPeak = peakStress > 0 && currentStress < peakStress * 0.95;
  
  if (isPastPeak) return '#ef4444'; // 红色 - 峰后
  if (isNearPeak) return '#f59e0b';  // 橙色 - 接近峰值
  return '#10b981'; // 绿色 - 正常
}
