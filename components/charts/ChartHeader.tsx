/**
 * 图表头部组件
 * Chart Header Component
 */

import React from 'react';
import { ChartStats } from './chartUtils';

interface ChartHeaderProps {
  testTypeLabel: string;
  stats: ChartStats;
  cycleCount: number;
  dataLength: number;
  controlMode?: 'force' | 'displacement' | 'program';
  activeChart?: 'all' | 'hysteresis';
  onChartChange?: (chart: 'all' | 'hysteresis') => void;
}

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  testTypeLabel,
  stats,
  cycleCount,
  dataLength,
  controlMode = 'force',
  activeChart = 'all',
  onChartChange,
}) => {
  return (
    <div className="flex justify-between items-center px-2">
      {/* 标题 */}
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
        实时曲线 Real-time Curves {testTypeLabel}
      </h3>
      
      {/* 右侧信息和控制 */}
      <div className="flex items-center gap-4">
        {/* 程序控制模式切换按钮 */}
        {controlMode === 'program' && onChartChange && (
          <div className="flex gap-1">
            <button
              onClick={() => onChartChange('all')}
              className={`px-2 py-0.5 text-[9px] font-mono rounded transition-all ${
                activeChart === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              标准视图
            </button>
            <button
              onClick={() => onChartChange('hysteresis')}
              className={`px-2 py-0.5 text-[9px] font-mono rounded transition-all ${
                activeChart === 'hysteresis' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              滞回曲线
            </button>
          </div>
        )}
        
        {/* 峰值信息 */}
        {stats.peakStress > 0 && (
          <span className="text-[10px] font-mono text-orange-400">
            峰值 Peak: {stats.peakStress.toFixed(2)} MPa / {stats.peakLoad.toFixed(2)} kN
          </span>
        )}
        
        {/* 能量信息 */}
        {stats.energy > 0 && (
          <span className="text-[10px] font-mono text-cyan-400">
            能量 W: {stats.energy.toFixed(2)} kJ/m³
          </span>
        )}
        
        {/* 循环次数 */}
        {cycleCount > 0 && (
          <span className="text-[10px] font-mono text-purple-400">
            循环 Cycles: {cycleCount}
          </span>
        )}
        
        {/* 数据采集状态 */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dataLength > 0 ? 'bg-green-400' : 'bg-slate-600'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dataLength > 0 ? 'bg-green-500' : 'bg-slate-700'}`}></span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">DAQ: {dataLength}</span>
        </div>
      </div>
    </div>
  );
};
