/**
 * 标准视图组件 - 三图布局
 * Standard View Component - Three Charts Layout
 */

import React from 'react';
import { SingleChart } from './SingleChart';
import { ChartDataPoint } from './chartUtils';
import { CHART_COLORS } from './chartStyles';

interface StandardViewProps {
  chartData: ChartDataPoint[];
  maxStress: number;
  chartColor: string;
}

export const StandardView: React.FC<StandardViewProps> = ({
  chartData,
  maxStress,
  chartColor,
}) => {
  return (
    <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
      {/* 图表1: 力-位移曲线 F-δ */}
      <SingleChart
        title="力-位移 F-δ"
        data={chartData}
        xDataKey="displacement"
        yDataKey="load"
        xLabel="δ (mm)"
        yLabel="F (kN)"
        lineColor={CHART_COLORS.forceDisplacement}
        tooltipFormatter={(value: number, name: string) => {
          if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载 Load'];
          return [value.toString(), name];
        }}
        tooltipLabelFormatter={(label) => `位移 δ: ${Number(label).toFixed(3)} mm`}
      />

      {/* 图表2: 力-时间曲线 F-t */}
      <SingleChart
        title="力-时间 F-t"
        data={chartData}
        xDataKey="time"
        yDataKey="load"
        xLabel="t (s)"
        yLabel="F (kN)"
        lineColor={chartColor}
        xDomain={undefined}
        xType="category"
        tooltipFormatter={(value: number, name: string) => {
          if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载 Load'];
          return [value.toString(), name];
        }}
        tooltipLabelFormatter={(label) => `时间 t: ${Number(label).toFixed(2)} s`}
      />

      {/* 图表3: 应力-应变曲线 σ-ε */}
      <SingleChart
        title="应力-应变 σ-ε"
        data={chartData}
        xDataKey="strainPercent"
        yDataKey="stress"
        xLabel="ε (‰)"
        yLabel="σ (MPa)"
        lineColor={CHART_COLORS.stressStrain}
        tooltipFormatter={(value: number, name: string) => {
          if (name === 'stress') return [`${value.toFixed(3)} MPa`, '应力 Stress'];
          return [value.toString(), name];
        }}
        tooltipLabelFormatter={(label) => `应变 ε: ${Number(label).toFixed(4)} ‰`}
        referenceLines={[
          { value: maxStress, stroke: CHART_COLORS.referenceLine, axis: 'y' },
          { value: 2, stroke: CHART_COLORS.referenceLineBlue, strokeDasharray: '5 5', axis: 'x' },
        ]}
      />
    </div>
  );
};
