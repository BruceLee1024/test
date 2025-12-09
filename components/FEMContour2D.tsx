/**
 * 2D FEM 应力云图组件
 * 在 2D 视图中显示试件的应力分布
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { 
  Mesh, FEMResult, ContourType,
} from '../services/fem/types';
import { 
  generateRectangularMesh, 
  applyBottomFixedBC, 
  getTopNodeIds,
} from '../services/fem/mesh';
import { solve } from '../services/fem/solver';

// Jet 颜色映射
const JET_COLORS = [
  [0, 0, 255],     // 蓝
  [0, 255, 255],   // 青
  [0, 255, 0],     // 绿
  [255, 255, 0],   // 黄
  [255, 0, 0],     // 红
];

/**
 * 根据值获取颜色
 */
function getColor(value: number, min: number, max: number): string {
  if (max <= min) return 'rgb(0, 255, 0)';
  
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const n = JET_COLORS.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  
  if (i >= n) {
    const c = JET_COLORS[n];
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }
  
  const c1 = JET_COLORS[i];
  const c2 = JET_COLORS[i + 1];
  
  const r = Math.round(c1[0] + f * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + f * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + f * (c2[2] - c1[2]));
  
  return `rgb(${r}, ${g}, ${b})`;
}

interface FEMContour2DProps {
  width: number;
  height: number;
  stress: number;  // 当前应力 MPa
  E?: number;      // 弹性模量 MPa
  nu?: number;     // 泊松比
  contourType?: 'vonMises' | 'sigmaY' | 'sigmaX';
  showGrid?: boolean;
  specimenWidth?: number;  // 试件宽度 mm
  specimenHeight?: number; // 试件高度 mm
}

export const FEMContour2D: React.FC<FEMContour2DProps> = ({
  width,
  height,
  stress,
  E = 30000,
  nu = 0.2,
  contourType = 'vonMises',
  showGrid = true,
  specimenWidth = 150,
  specimenHeight = 150,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [result, setResult] = useState<FEMResult | null>(null);
  
  // 网格分辨率
  const nx = 12, ny = 12;
  
  // 初始化网格
  useEffect(() => {
    const material = {
      id: 1,
      name: 'Concrete',
      E,
      nu,
    };
    
    const newMesh = generateRectangularMesh(specimenWidth, specimenHeight, nx, ny, material);
    applyBottomFixedBC(newMesh);
    setMesh(newMesh);
  }, [specimenWidth, specimenHeight, E, nu]);
  
  // 当应力变化时求解
  useEffect(() => {
    if (!mesh || Math.abs(stress) < 0.1) {
      setResult(null);
      return;
    }
    
    // 获取顶部节点
    const topNodeIds = getTopNodeIds(mesh);
    const dx = specimenWidth / nx;
    
    // 施加均布压力（负值=压缩）
    const appliedStress = -Math.abs(stress);
    const forcePerNode = appliedStress * dx * 1;
    
    const nodalLoads = topNodeIds.map((nodeId, idx) => ({
      nodeId,
      fy: idx === 0 || idx === topNodeIds.length - 1 
        ? forcePerNode / 2 
        : forcePerNode,
    }));
    
    try {
      const femResult = solve(mesh, nodalLoads, [], 'plane_stress');
      setResult(femResult);
    } catch (e) {
      console.error('FEM solve error:', e);
    }
  }, [mesh, stress, specimenWidth]);
  
  // 计算云图值范围
  const { minValue, maxValue } = useMemo(() => {
    if (!result) return { minValue: 0, maxValue: 1 };
    
    const values = result.elements.map(e => {
      switch (contourType) {
        case 'sigmaY': return Math.abs(e.sigmaY);
        case 'sigmaX': return Math.abs(e.sigmaX);
        default: return e.vonMises;
      }
    });
    
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values),
    };
  }, [result, contourType]);
  
  // 绘制云图
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mesh) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    // 计算绘图区域
    const padding = 50;
    const colorBarWidth = 50;
    const plotWidth = width - padding * 2 - colorBarWidth;
    const plotHeight = height - padding * 2;
    
    // 网格边界
    const meshMinX = Math.min(...mesh.nodes.map(n => n.x));
    const meshMaxX = Math.max(...mesh.nodes.map(n => n.x));
    const meshMinY = Math.min(...mesh.nodes.map(n => n.y));
    const meshMaxY = Math.max(...mesh.nodes.map(n => n.y));
    
    const meshWidth = meshMaxX - meshMinX;
    const meshHeight = meshMaxY - meshMinY;
    
    // 缩放
    const scaleX = plotWidth / meshWidth;
    const scaleY = plotHeight / meshHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = padding + (plotWidth - meshWidth * scale) / 2;
    const offsetY = padding + (plotHeight - meshHeight * scale) / 2;
    
    // 坐标转换
    const toCanvasX = (x: number) => offsetX + (x - meshMinX) * scale;
    const toCanvasY = (y: number) => height - offsetY - (y - meshMinY) * scale;
    
    // 绘制单元
    mesh.elements.forEach(element => {
      let value = 0;
      
      if (result) {
        const elemResult = result.elements.find(e => e.elementId === element.id);
        if (elemResult) {
          switch (contourType) {
            case 'sigmaY': value = Math.abs(elemResult.sigmaY); break;
            case 'sigmaX': value = Math.abs(elemResult.sigmaX); break;
            default: value = elemResult.vonMises;
          }
        }
      }
      
      const color = result ? getColor(value, minValue, maxValue) : 'rgb(100, 100, 100)';
      
      // 绘制四边形
      ctx.beginPath();
      element.nodes.forEach((nodeId, i) => {
        const node = mesh.nodes.find(n => n.id === nodeId)!;
        const cx = toCanvasX(node.x);
        const cy = toCanvasY(node.y);
        
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      
      // 网格线
      if (showGrid) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });
    
    // 绘制颜色条
    if (result) {
      const barX = width - colorBarWidth - 10;
      const barY = padding;
      const barWidth = 15;
      const barHeight = height - padding * 2;
      
      // 渐变
      const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
      JET_COLORS.forEach((color, i) => {
        gradient.addColorStop(i / (JET_COLORS.length - 1), `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // 边框
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // 刻度
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      
      const numTicks = 5;
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const val = minValue + t * (maxValue - minValue);
        const y = barY + barHeight * (1 - t);
        ctx.fillText(val.toFixed(2), barX + barWidth + 4, y + 3);
      }
    }
    
    // 标题
    const titleMap = {
      vonMises: 'von Mises 应力 (MPa)',
      sigmaY: 'σy 应力 (MPa)',
      sigmaX: 'σx 应力 (MPa)',
    };
    
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleMap[contourType], width / 2 - 20, 20);
    
  }, [mesh, result, width, height, contourType, showGrid, minValue, maxValue]);
  
  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height}
      className="absolute inset-0"
    />
  );
};

export default FEMContour2D;
