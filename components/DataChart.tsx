import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DataPoint } from '../types';

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
  
  // 计算峰值和统计信息
  const stats = useMemo(() => {
    if (data.length === 0) return { peakStress: 0, peakLoad: 0, peakStrain: 0, currentStress: 0, energy: 0 };
    
    let peakStress = 0, peakLoad = 0, peakStrain = 0;
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
  }, [data]);
  
  // 颜色随阶段变化
  const isNearPeak = stats.currentStress > maxStress * 0.9;
  const isPastPeak = stats.peakStress > 0 && stats.currentStress < stats.peakStress * 0.95;
  const chartColor = isPastPeak ? '#ef4444' : isNearPeak ? '#f59e0b' : '#10b981';

  // 转换数据
  const chartData = useMemo(() => data.map((d: DataPoint, index: number) => ({
    ...d,
    strainPercent: d.strain * 1000, // 转换为千分比 ‰
    displacement: d.strain * specimenHeight,   // 计算位移
    index,
  })), [data, specimenHeight]);
  
  // 检测滞回循环数量（用于程序控制模式显示）
  const cycleCount = useMemo(() => {
    if (controlMode !== 'program' || data.length < 10) return 0;
    
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
  }, [data, controlMode]);

  // 通用图表样式
  const gridStyle = { strokeDasharray: '3 3', stroke: '#1e293b' };
  const axisStyle = { stroke: '#64748b' };
  const tickStyle = { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' };
  const tooltipStyle = { 
    backgroundColor: 'rgba(0, 0, 0, 0.9)', 
    border: '1px solid #334155', 
    borderRadius: '4px', 
    fontSize: '11px', 
    fontFamily: 'monospace', 
    color: '#fff' 
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* 标题栏 */}
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          实时曲线 Real-time Curves {testTypeLabel}
        </h3>
        <div className="flex items-center gap-4">
          {/* 程序控制模式切换按钮 */}
          {controlMode === 'program' && (
            <div className="flex gap-1">
              <button
                onClick={() => setActiveChart('all')}
                className={`px-2 py-0.5 text-[9px] font-mono rounded transition-all ${
                  activeChart === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                标准视图
              </button>
              <button
                onClick={() => setActiveChart('hysteresis')}
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
          {stats.peakStress > 0 && (
            <span className="text-[10px] font-mono text-orange-400">
              峰值 Peak: {stats.peakStress.toFixed(2)} MPa / {stats.peakLoad.toFixed(2)} kN
            </span>
          )}
          {stats.energy > 0 && (
            <span className="text-[10px] font-mono text-cyan-400">
              能量 W: {stats.energy.toFixed(2)} kJ/m³
            </span>
          )}
          {cycleCount > 0 && (
            <span className="text-[10px] font-mono text-purple-400">
              循环 Cycles: {cycleCount}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${data.length > 0 ? 'bg-green-400' : 'bg-slate-600'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${data.length > 0 ? 'bg-green-500' : 'bg-slate-700'}`}></span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">DAQ: {data.length}</span>
          </div>
        </div>
      </div>

      {/* 滞回曲线专用视图 */}
      {activeChart === 'hysteresis' && controlMode === 'program' && (
        <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
          {/* 大型应力-应变滞回曲线 */}
          <div className="bg-black rounded-lg border border-purple-700 p-2 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
            </div>
            <div className="text-[10px] font-mono text-purple-400 mb-1 text-center">
              应力-应变滞回曲线 σ-ε Hysteresis
            </div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis 
                  dataKey="strainPercent" 
                  {...axisStyle}
                  tick={tickStyle}
                  tickLine={axisStyle}
                  label={{ value: 'ε (‰)', position: 'bottom', fill: '#64748b', fontSize: 9, offset: -5 }}
                  domain={[0, 'auto']}
                  type="number"
                />
                <YAxis 
                  domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]} 
                  {...axisStyle}
                  tick={tickStyle}
                  tickLine={axisStyle}
                  label={{ value: 'σ (MPa)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9, offset: 10 }}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'stress') return [`${value.toFixed(3)} MPa`, '应力'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `应变 ε: ${Number(label).toFixed(4)} ‰`}
                />
                <ReferenceLine y={maxStress} stroke="#dc2626" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="stress" 
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 力-位移滞回曲线 */}
          <div className="bg-black rounded-lg border border-purple-700 p-2 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
            </div>
            <div className="text-[10px] font-mono text-purple-400 mb-1 text-center">
              力-位移滞回曲线 F-δ Hysteresis
            </div>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis 
                  dataKey="displacement" 
                  {...axisStyle}
                  tick={tickStyle}
                  tickLine={axisStyle}
                  label={{ value: 'δ (mm)', position: 'bottom', fill: '#64748b', fontSize: 9, offset: -5 }}
                  domain={[0, 'auto']}
                  type="number"
                />
                <YAxis 
                  domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]} 
                  {...axisStyle}
                  tick={tickStyle}
                  tickLine={axisStyle}
                  label={{ value: 'F (kN)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9, offset: 10 }}
                  allowDataOverflow={false}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `位移 δ: ${Number(label).toFixed(3)} mm`}
                />
                <Line 
                  type="monotone" 
                  dataKey="load" 
                  stroke="#ec4899"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 三个图表网格布局 - 标准视图 */}
      {activeChart === 'all' && (
      <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
        
        {/* 图表1: 力-位移曲线 F-δ */}
        <div className="bg-black rounded-lg border border-slate-700 p-2 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-5 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mb-1 text-center flex-shrink-0">
            力-位移 F-δ
          </div>
          <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis 
                dataKey="displacement" 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 'δ (mm)', position: 'bottom', fill: '#64748b', fontSize: 8, offset: -5 }}
                domain={[0, 'auto']}
                type="number"
              />
              <YAxis 
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]} 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 'F (kN)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 8, offset: 10 }}
                allowDataOverflow={false}
              />
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载 Load'];
                  return [value, name];
                }}
                labelFormatter={(label) => `位移 δ: ${Number(label).toFixed(3)} mm`}
              />
              <Line 
                type="monotone" 
                dataKey="load" 
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false} 
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* 图表2: 力-时间曲线 F-t */}
        <div className="bg-black rounded-lg border border-slate-700 p-2 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-5 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mb-1 text-center flex-shrink-0">
            力-时间 F-t
          </div>
          <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis 
                dataKey="time" 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 't (s)', position: 'bottom', fill: '#64748b', fontSize: 8, offset: -5 }}
              />
              <YAxis 
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]} 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 'F (kN)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 8, offset: 10 }}
                allowDataOverflow={false}
              />
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载 Load'];
                  return [value, name];
                }}
                labelFormatter={(label) => `时间 t: ${Number(label).toFixed(2)} s`}
              />
              <Line 
                type="monotone" 
                dataKey="load" 
                stroke={chartColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false} 
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* 图表3: 应力-应变曲线 σ-ε */}
        <div className="bg-black rounded-lg border border-slate-700 p-2 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-5 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '15px 15px' }}>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mb-1 text-center flex-shrink-0">
            应力-应变 σ-ε
          </div>
          <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis 
                dataKey="strainPercent" 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 'ε (‰)', position: 'bottom', fill: '#64748b', fontSize: 8, offset: -5 }}
                domain={[0, 'auto']}
                type="number"
              />
              <YAxis 
                domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 1)]} 
                {...axisStyle}
                tick={tickStyle}
                tickLine={axisStyle}
                label={{ value: 'σ (MPa)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 8, offset: 10 }}
                allowDataOverflow={false}
              />
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  if (name === 'stress') return [`${value.toFixed(3)} MPa`, '应力 Stress'];
                  return [value, name];
                }}
                labelFormatter={(label) => `应变 ε: ${Number(label).toFixed(4)} ‰`}
              />
              <ReferenceLine y={maxStress} stroke="#dc2626" strokeDasharray="3 3" />
              <ReferenceLine x={2} stroke="#3b82f6" strokeDasharray="5 5" />
              <Line 
                type="monotone" 
                dataKey="stress" 
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false} 
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
