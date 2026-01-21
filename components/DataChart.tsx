/**
 * 数据图表组件 - 重构版
 * Data Chart Component - Refactored
 */

import React, { useMemo, useState } from 'react';
import { DataPoint } from '../types';
import { ChartHeader } from './charts/ChartHeader';
import { StandardView } from './charts/StandardView';
import { HysteresisView } from './charts/HysteresisView';
import { 
  calculateChartStats, 
  transformChartData, 
  detectCycleCount,
  getChartColor 
} from './charts/chartUtils';

interface DataChartProps {
  data: DataPoint[];
  maxStress: number;
  testTypeLabel: string;
  controlMode?: 'force' | 'displacement' | 'program';
  specimenHeight?: number;
}

export const DataChart: React.FC<DataChartProps> = ({ 
  data, 
  maxStress, 
  testTypeLabel,
  controlMode = 'force',
  specimenHeight = 150
}) => {
  const [activeChart, setActiveChart] = useState<'all' | 'hysteresis'>('all');
  
  // 计算统计信息
  const stats = useMemo(() => calculateChartStats(data), [data]);
  
  // 转换数据
  const chartData = useMemo(() => transformChartData(data, specimenHeight), [data, specimenHeight]);
  
  // 检测循环数量
  const cycleCount = useMemo(() => {
    if (controlMode !== 'program') return 0;
    return detectCycleCount(data);
  }, [data, controlMode]);
  
  // 获取图表颜色
  const chartColor = useMemo(() => 
    getChartColor(stats.currentStress, stats.peakStress, maxStress),
    [stats.currentStress, stats.peakStress, maxStress]
  );

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* 标题栏 */}
      <ChartHeader
        testTypeLabel={testTypeLabel}
        stats={stats}
        cycleCount={cycleCount}
        dataLength={data.length}
        controlMode={controlMode}
        activeChart={activeChart}
        onChartChange={setActiveChart}
      />

      {/* 滞回曲线专用视图 */}
      {activeChart === 'hysteresis' && controlMode === 'program' && (
        <HysteresisView
          chartData={chartData}
          maxStress={maxStress}
        />
      )}

      {/* 标准视图 - 三图布局 */}
      {activeChart === 'all' && (
        <StandardView
          chartData={chartData}
          maxStress={maxStress}
          chartColor={chartColor}
        />
      )}
    </div>
  );
};
