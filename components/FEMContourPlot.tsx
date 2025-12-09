/**
 * FEM 应力云图可视化组件
 * FEM Contour Plot Visualization Component
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { 
  Mesh, FEMResult, ContourType, ColorMap, COLOR_MAPS,
  ElementResult, NodeResult 
} from '../services/fem/types';

interface FEMContourPlotProps {
  mesh: Mesh;
  result: FEMResult | null;
  contourType: ContourType;
  colorMapName?: string;
  showMesh?: boolean;
  showDeformed?: boolean;
  deformationScale?: number;
  width?: number;
  height?: number;
  showColorBar?: boolean;
  title?: string;
}

/**
 * 根据值获取颜色
 */
function getColor(value: number, min: number, max: number, colorMap: ColorMap): string {
  if (max === min) return colorMap.colors[Math.floor(colorMap.colors.length / 2)];
  
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const n = colorMap.colors.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  
  if (i >= n) return colorMap.colors[n];
  
  // 线性插值颜色
  const c1 = hexToRgb(colorMap.colors[i]);
  const c2 = hexToRgb(colorMap.colors[i + 1]);
  
  const r = Math.round(c1.r + f * (c2.r - c1.r));
  const g = Math.round(c1.g + f * (c2.g - c1.g));
  const b = Math.round(c1.b + f * (c2.b - c1.b));
  
  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

/**
 * 获取单元的云图值
 */
function getElementValue(element: ElementResult, contourType: ContourType): number {
  switch (contourType) {
    case 'stress_x': return element.sigmaX;
    case 'stress_y': return element.sigmaY;
    case 'stress_xy': return element.tauXY;
    case 'stress_1': return element.sigma1;
    case 'stress_2': return element.sigma2;
    case 'von_mises': return element.vonMises;
    case 'strain_x': return element.epsilonX * 1000; // 转为千分比
    case 'strain_y': return element.epsilonY * 1000;
    default: return element.vonMises;
  }
}

/**
 * 获取节点的云图值
 */
function getNodeValue(node: NodeResult, contourType: ContourType): number {
  switch (contourType) {
    case 'displacement_x': return node.ux;
    case 'displacement_y': return node.uy;
    case 'displacement_mag': return Math.sqrt(node.ux * node.ux + node.uy * node.uy);
    default: return 0;
  }
}

/**
 * 云图类型标签
 */
const CONTOUR_LABELS: Record<ContourType, string> = {
  displacement_x: '位移 Ux (mm)',
  displacement_y: '位移 Uy (mm)',
  displacement_mag: '位移幅值 |U| (mm)',
  stress_x: '应力 σx (MPa)',
  stress_y: '应力 σy (MPa)',
  stress_xy: '剪应力 τxy (MPa)',
  stress_1: '主应力 σ1 (MPa)',
  stress_2: '主应力 σ2 (MPa)',
  von_mises: 'von Mises 应力 (MPa)',
  strain_x: '应变 εx (‰)',
  strain_y: '应变 εy (‰)',
};

export const FEMContourPlot: React.FC<FEMContourPlotProps> = ({
  mesh,
  result,
  contourType,
  colorMapName = 'jet',
  showMesh = true,
  showDeformed = true,
  deformationScale = 50,
  width = 400,
  height = 500,
  showColorBar = true,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorMap = COLOR_MAPS[colorMapName] || COLOR_MAPS.jet;
  
  // 计算云图值范围
  const { minValue, maxValue, values } = useMemo(() => {
    if (!result) return { minValue: 0, maxValue: 1, values: [] };
    
    let vals: number[] = [];
    
    if (contourType.startsWith('displacement')) {
      vals = result.nodes.map(n => getNodeValue(n, contourType));
    } else {
      vals = result.elements.map(e => getElementValue(e, contourType));
    }
    
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    
    return { minValue: min, maxValue: max, values: vals };
  }, [result, contourType]);
  
  // 绘制云图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空画布
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    // 计算网格边界
    const xs = mesh.nodes.map(n => n.x);
    const ys = mesh.nodes.map(n => n.y);
    const meshMinX = Math.min(...xs);
    const meshMaxX = Math.max(...xs);
    const meshMinY = Math.min(...ys);
    const meshMaxY = Math.max(...ys);
    
    const meshWidth = meshMaxX - meshMinX;
    const meshHeight = meshMaxY - meshMinY;
    
    // 计算缩放和偏移
    const padding = 40;
    const plotWidth = width - 2 * padding - (showColorBar ? 60 : 0);
    const plotHeight = height - 2 * padding;
    
    const scaleX = plotWidth / meshWidth;
    const scaleY = plotHeight / meshHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = padding + (plotWidth - meshWidth * scale) / 2;
    const offsetY = padding + (plotHeight - meshHeight * scale) / 2;
    
    // 坐标转换函数
    const toCanvasX = (x: number, ux: number = 0) => {
      const deformedX = showDeformed ? x + ux * deformationScale : x;
      return offsetX + (deformedX - meshMinX) * scale;
    };
    const toCanvasY = (y: number, uy: number = 0) => {
      const deformedY = showDeformed ? y + uy * deformationScale : y;
      return height - offsetY - (deformedY - meshMinY) * scale;
    };
    
    // 获取节点位移
    const getNodeDisp = (nodeId: number) => {
      const nodeResult = result.nodes.find(n => n.nodeId === nodeId);
      return nodeResult ? { ux: nodeResult.ux, uy: nodeResult.uy } : { ux: 0, uy: 0 };
    };
    
    // 绘制单元填充
    mesh.elements.forEach((element, idx) => {
      const elemResult = result.elements.find(e => e.elementId === element.id);
      if (!elemResult) return;
      
      const value = getElementValue(elemResult, contourType);
      const color = getColor(value, minValue, maxValue, colorMap);
      
      ctx.beginPath();
      element.nodes.forEach((nodeId, i) => {
        const node = mesh.nodes.find(n => n.id === nodeId)!;
        const disp = getNodeDisp(nodeId);
        const cx = toCanvasX(node.x, disp.ux);
        const cy = toCanvasY(node.y, disp.uy);
        
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });
    
    // 绘制网格线
    if (showMesh) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.5;
      
      mesh.elements.forEach(element => {
        ctx.beginPath();
        element.nodes.forEach((nodeId, i) => {
          const node = mesh.nodes.find(n => n.id === nodeId)!;
          const disp = getNodeDisp(nodeId);
          const cx = toCanvasX(node.x, disp.ux);
          const cy = toCanvasY(node.y, disp.uy);
          
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
        ctx.stroke();
      });
    }
    
    // 绘制颜色条
    if (showColorBar) {
      const barX = width - 50;
      const barY = padding;
      const barWidth = 15;
      const barHeight = height - 2 * padding;
      
      // 渐变色条
      const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
      colorMap.colors.forEach((color, i) => {
        gradient.addColorStop(i / (colorMap.colors.length - 1), color);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // 边框
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // 刻度标签
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      
      const numTicks = 5;
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const value = minValue + t * (maxValue - minValue);
        const y = barY + barHeight * (1 - t);
        
        ctx.fillText(value.toFixed(2), barX + barWidth + 4, y + 3);
      }
    }
    
    // 绘制标题
    if (title || CONTOUR_LABELS[contourType]) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title || CONTOUR_LABELS[contourType], width / 2 - (showColorBar ? 30 : 0), 20);
    }
    
  }, [mesh, result, contourType, colorMap, showMesh, showDeformed, deformationScale, width, height, showColorBar, minValue, maxValue, title]);
  
  return (
    <div className="relative">
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="rounded-lg border border-slate-700"
      />
      {!result && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
          <span className="text-slate-500 text-sm">运行分析以查看结果</span>
        </div>
      )}
    </div>
  );
};

export default FEMContourPlot;
