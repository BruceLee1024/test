/**
 * 滞回视图组件 - 双图布局
 * Hysteresis View Component - Two Charts Layout
 */

import React from 'react';
import { SingleChart } from './SingleChart';
import { ChartDataPoint } from './chartUtils';
import { CHART_COLORS } from './chartStyles';

interface HysteresisViewProps {
  chartData: ChartDataPoint[];
  maxStress: number;
}

export const HysteresisView: React.FC<HysteresisViewProps> = ({
  chartData,
  maxStress,
}) => {
  return (
    <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
      {/* 应力-应变滞回曲线 */}
      <SingleChart
        title="应力-应变滞回曲线 σ-ε Hysteresis"
        data={chartData}
        xDataKey="strainPercent"
        yDataKey="stress"
        xLabel="ε (‰)"
        yLabel="σ (MPa)"
        lineColor={CHART_COLORS.hysteresisStress}
        tooltipFormatter={(value: number, name: string) => {
          if (name === 'stress') return [`${value.toFixed(3)} MPa`, '应力'];
          return [value.toString(), name];
        }}
        tooltipLabelFormatter={(label) => `应变 ε: ${Number(label).toFixed(4)} ‰`}
        referenceLines={[
          { value: maxStress, stroke: CHART_COLORS.referenceLine, axis: 'y' },
        ]}
        borderColor="border-purple-700"
        isSmall={false}
      />

      {/* 力-位移滞回曲线 */}
      <SingleChart
        title="力-位移滞回曲线 F-δ Hysteresis"
        data={chartData}
        xDataKey="displacement"
        yDataKey="load"
        xLabel="δ (mm)"
        yLabel="F (kN)"
        lineColor={CHART_COLORS.hysteresisForce}
        tooltipFormatter={(value: number, name: string) => {
          if (name === 'load') return [`${value.toFixed(2)} kN`, '荷载'];
          return [value.toString(), name];
        }}
        tooltipLabelFormatter={(label) => `位移 δ: ${Number(label).toFixed(3)} mm`}
        borderColor="border-purple-700"
        isSmall={false}
      />
    </div>
  );
};
