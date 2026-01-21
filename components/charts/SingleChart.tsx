/**
 * 单个图表组件
 * Single Chart Component
 */

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartDataPoint } from './chartUtils';
import { CHART_STYLES, CHART_MARGINS, GRID_BACKGROUND_STYLE } from './chartStyles';

interface SingleChartProps {
  title: string;
  data: ChartDataPoint[];
  xDataKey: string;
  yDataKey: string;
  xLabel: string;
  yLabel: string;
  lineColor: string;
  xDomain?: [number | 'auto', number | 'auto'];
  yDomain?: [number, (dataMax: number) => number];
  xType?: 'number' | 'category';
  tooltipFormatter?: (value: number, name: string) => [string, string];
  tooltipLabelFormatter?: (label: any) => string;
  referenceLines?: Array<{ value: number; stroke: string; strokeDasharray?: string; axis: 'x' | 'y' }>;
  borderColor?: string;
  isSmall?: boolean;
}

export const SingleChart: React.FC<SingleChartProps> = ({
  title,
  data,
  xDataKey,
  yDataKey,
  xLabel,
  yLabel,
  lineColor,
  xDomain = [0, 'auto'],
  yDomain = [0, (dataMax: number) => Math.max(dataMax * 1.1, 1)],
  xType = 'number',
  tooltipFormatter,
  tooltipLabelFormatter,
  referenceLines = [],
  borderColor = 'border-slate-700',
  isSmall = true,
}) => {
  const tickStyle = isSmall ? CHART_STYLES.tickSmall : CHART_STYLES.tick;
  const fontSize = isSmall ? 8 : 9;
  const margin = isSmall ? CHART_MARGINS.standard : CHART_MARGINS.hysteresis;

  return (
    <div className={`bg-black rounded-lg border ${borderColor} p-2 relative overflow-hidden flex flex-col`}>
      {/* 背景网格 */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none" 
        style={GRID_BACKGROUND_STYLE}
      />
      
      {/* 标题 */}
      <div className={`text-[10px] font-mono ${borderColor.includes('purple') ? 'text-purple-400' : 'text-slate-500'} mb-1 text-center flex-shrink-0`}>
        {title}
      </div>
      
      {/* 图表 */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={isSmall ? "100%" : "85%"}>
          <LineChart data={data} margin={margin}>
            <CartesianGrid {...CHART_STYLES.grid} />
            
            {/* X轴 */}
            <XAxis 
              dataKey={xDataKey}
              {...CHART_STYLES.axis}
              tick={tickStyle}
              tickLine={CHART_STYLES.axis}
              label={{ value: xLabel, position: 'bottom', fill: '#64748b', fontSize, offset: -5 }}
              domain={xDomain}
              type={xType}
            />
            
            {/* Y轴 */}
            <YAxis 
              domain={yDomain}
              {...CHART_STYLES.axis}
              tick={tickStyle}
              tickLine={CHART_STYLES.axis}
              tickFormatter={(value) => value.toFixed(1)}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize, offset: 10 }}
              allowDataOverflow={false}
            />
            
            {/* Tooltip */}
            <Tooltip 
              contentStyle={CHART_STYLES.tooltip}
              formatter={tooltipFormatter}
              labelFormatter={tooltipLabelFormatter}
            />
            
            {/* 参考线 */}
            {referenceLines.map((line, index) => (
              <ReferenceLine
                key={index}
                {...(line.axis === 'x' ? { x: line.value } : { y: line.value })}
                stroke={line.stroke}
                strokeDasharray={line.strokeDasharray || '3 3'}
              />
            ))}
            
            {/* 数据线 */}
            <Line 
              type="monotone" 
              dataKey={yDataKey}
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
