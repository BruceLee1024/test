import React, { useMemo, useRef, useState, useEffect } from 'react';
import { TestType, TestStatus } from '../types';
import { 
  generateRectangularMesh, 
  applyCompressionBC, 
  getTopNodeIds,
} from '../services/fem/mesh';
import { solve } from '../services/fem/solver';
import { Mesh, FEMResult } from '../services/fem/types';

interface TestCanvasProps {
  testType: TestType;
  status: TestStatus;
  progress: number;
  stress: number;
  safetyDoorOpen: boolean;
  actuatorPos: number;
  crackPaths?: string[];
  phase?: string;
  onSpecimenClick?: () => void;
  onMachineClick?: () => void;
  controlMode?: 'force' | 'displacement' | 'program';
  cyclePhase?: 'loading' | 'holding_upper' | 'unloading' | 'holding_lower' | 'final';
  specimenDimensions?: {
    width?: number;   // mm
    height: number;   // mm
    diameter?: number; // mm (圆柱体)
  };
  specimenLabel?: string; // 显示的尺寸标签
  showFEMContour?: boolean; // 是否显示 FEM 云图
  E?: number; // 弹性模量 MPa
  fc?: number; // 抗压强度 MPa
  epsilon0?: number; // 峰值应变
  constitutiveModel?: 'linear' | 'hognestad' | 'gb50010' | 'damage' | 'mander' | 'eurocode'; // 本构模型
}

// Jet 颜色映射
const JET_COLORS = [
  [0, 0, 255],     // 蓝
  [0, 255, 255],   // 青
  [0, 255, 0],     // 绿
  [255, 255, 0],   // 黄
  [255, 0, 0],     // 红
];

function getContourColor(value: number, min: number, max: number): string {
  if (max <= min) return 'rgb(0, 255, 0)';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const n = JET_COLORS.length - 1;
  const i = Math.floor(t * n);
  const f = t * n - i;
  if (i >= n) return `rgb(${JET_COLORS[n][0]}, ${JET_COLORS[n][1]}, ${JET_COLORS[n][2]})`;
  const c1 = JET_COLORS[i], c2 = JET_COLORS[i + 1];
  const r = Math.round(c1[0] + f * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + f * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + f * (c2[2] - c1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

export const TestCanvas: React.FC<TestCanvasProps> = ({ 
  testType, 
  status, 
  progress, 
  stress, 
  safetyDoorOpen, 
  actuatorPos, 
  crackPaths = [], 
  phase = 'seating',
  onSpecimenClick,
  onMachineClick,
  controlMode = 'stress',
  cyclePhase = 'loading',
  specimenDimensions = { width: 150, height: 150, diameter: undefined },
  specimenLabel = '150mm',
  showFEMContour = true,
  E = 30000,
  fc,
  epsilon0,
  constitutiveModel = 'linear',
}) => {
  // 如果传入了 crackPaths，优先使用传入的裂缝路径
  const useExternalCracks = crackPaths && crackPaths.length > 0;
  void phase; // phase 用于未来扩展
  
  // FEM 状态
  const [femMesh, setFemMesh] = useState<Mesh | null>(null);
  const [femResult, setFemResult] = useState<FEMResult | null>(null);
  const femMeshRef = useRef<Mesh | null>(null);
  
  // 网格参数 - 增加密度以捕捉端部效应
  const femNx = 12, femNy = 16; // 更细的网格
  const specimenW = specimenDimensions.width || 150;
  const specimenH = specimenDimensions.height;
  
  // 初始化 FEM 网格
  useEffect(() => {
    if (!showFEMContour) return;
    
    // 创建材料 - 使用系统设置中的本构模型
    const material = { 
      id: 1, 
      name: 'Concrete', 
      E, 
      nu: 0.2,
      fc: fc,
      epsilon0: epsilon0,
      constitutive: constitutiveModel,
    };
    const mesh = generateRectangularMesh(specimenW, specimenH, femNx, femNy, material);
    applyCompressionBC(mesh); // 使用压缩试验边界条件
    femMeshRef.current = mesh;
    setFemMesh(mesh);
  }, [showFEMContour, specimenW, specimenH, E, fc, epsilon0, constitutiveModel]);
  
  // 当应力变化时求解 FEM
  useEffect(() => {
    if (!showFEMContour || !femMeshRef.current || Math.abs(stress) < 0.1) {
      setFemResult(null);
      return;
    }
    
    const mesh = femMeshRef.current;
    const topNodeIds = getTopNodeIds(mesh);
    
    // 计算节点力 - 使用梯形法则将均布载荷转换为节点力
    // 应力 σ (MPa = N/mm²)，宽度 (mm)，厚度 t = 1 mm（平面应力）
    const dx = specimenW / femNx; // 单元宽度 (mm)
    const thickness = 1; // 平面应力假设厚度 (mm)
    
    // 每个单元的力 = σ × dx × t
    // 梯形法则：边缘节点承担半个单元的力，中间节点承担一个单元的力
    const forcePerElement = -Math.abs(stress) * dx * thickness; // 每单元的力（向下为负）
    
    const nodalLoads = topNodeIds.map((nodeId, idx) => ({
      nodeId,
      // 边缘节点取半力，中间节点取全力
      fy: (idx === 0 || idx === topNodeIds.length - 1) 
        ? forcePerElement / 2 
        : forcePerElement,
    }));
    
    try {
      const result = solve(mesh, nodalLoads, [], 'plane_stress');
      
      // 非线性本构：应变映射法
      // 1. FEM 计算的应变分布是准确的
      // 2. 用 Hognestad 本构曲线将应变映射到应力
      const useNonlinear = fc && epsilon0;
      
      const nonlinearResult = {
        ...result,
        elements: result.elements.map(e => {
          if (!useNonlinear) return e;
          
          // 获取 Y 方向应变（压缩为负）
          const strainY = Math.abs(e.epsilonY);
          
          // Hognestad 本构：σ = fc * [2(ε/ε0) - (ε/ε0)²]
          let sigmaY_nonlinear: number;
          if (strainY <= epsilon0) {
            const ratio = strainY / epsilon0;
            sigmaY_nonlinear = fc * (2 * ratio - ratio * ratio);
          } else {
            // 软化段：线性下降
            const postPeakRatio = (strainY - epsilon0) / epsilon0;
            sigmaY_nonlinear = fc * Math.max(0.2, 1 - 0.5 * postPeakRatio);
          }
          
          // 保持应力符号（压缩为负）
          sigmaY_nonlinear = e.epsilonY < 0 ? -sigmaY_nonlinear : sigmaY_nonlinear;
          
          // X 方向应力按比例缩放
          const stressRatio = strainY > 0 ? Math.abs(sigmaY_nonlinear) / (mesh.materials[0].E * strainY) : 1;
          const sigmaX_nonlinear = e.sigmaX * stressRatio;
          const tauXY_nonlinear = e.tauXY * stressRatio;
          
          // 重新计算主应力和 von Mises
          const sigmaAvg = (sigmaX_nonlinear + sigmaY_nonlinear) / 2;
          const R = Math.sqrt(Math.pow((sigmaX_nonlinear - sigmaY_nonlinear) / 2, 2) + tauXY_nonlinear * tauXY_nonlinear);
          
          return {
            ...e,
            sigmaX: sigmaX_nonlinear,
            sigmaY: sigmaY_nonlinear,
            tauXY: tauXY_nonlinear,
            sigma1: sigmaAvg + R,
            sigma2: sigmaAvg - R,
            vonMises: Math.sqrt(
              sigmaX_nonlinear * sigmaX_nonlinear + 
              sigmaY_nonlinear * sigmaY_nonlinear - 
              sigmaX_nonlinear * sigmaY_nonlinear + 
              3 * tauXY_nonlinear * tauXY_nonlinear
            ),
          };
        }),
      };
      
      setFemResult(nonlinearResult);
    } catch (e) {
      console.error('FEM solve error:', e);
    }
  }, [showFEMContour, stress, specimenW, fc, epsilon0]);
  
  // 云图值范围 - 以材料强度 fc 为最大值基准（固定范围）
  const femMinValue = 0;
  const femMaxValue = fc || 30; // 使用材料抗压强度作为最大值
  
  /**
   * 布局说明（Y坐标从上到下）：
   * - 顶部横梁: Y=30, 高度70
   * - 液压缸: Y=100, 高度80
   * - 移动部件起始位置: Y=180 (活塞杆顶部)
   * - 试件固定位置: 底部在 Y=488 (下压板顶部)
   * - 下压板: Y=488, 高度18
   * - 底座: Y=510
   * 
   * 动画：
   * - actuatorPos: 0 = 初始位置（上方有间隙）, 1 = 接触位置
   * - 移动部件向下移动 = headTy 增加
   */
  
  // 计算试件 SVG 尺寸（提前计算，供后续使用）
  const baseScale = 100 / 150;
  const actualHeight = specimenDimensions.height;
  const actualWidth = specimenDimensions.width || specimenDimensions.diameter || 150;
  const svgSpecimenHeight = Math.min(150, Math.max(60, actualHeight * baseScale));
  const svgSpecimenWidth = Math.min(120, Math.max(60, actualWidth * baseScale));
  
  // 下压板位置固定
  const lowerPlatenY = 430;
  // 试件顶部位置 = 下压板位置 - 试件高度
  const specimenTopY = lowerPlatenY - svgSpecimenHeight;
  
  // 间隙大小（初始状态上压板与试件之间的距离）
  // 上压板底部在移动部件组内 Y=260+18=278
  // 移动部件组初始位置 Y=0，所以上压板底部绝对位置 = 278
  // 接触时需要移动到试件顶部位置
  const upperPlatenBottomInGroup = 278; // 上压板底部在组内的 Y 坐标
  const initialGap = specimenTopY - upperPlatenBottomInGroup; // 动态计算间隙
  
  // 移动距离：actuatorPos 从 0->1 时，移动部件向下移动 initialGap 距离
  const approachDistance = initialGap * actuatorPos;
  
  // 压缩变形（试验运行时）- 根据试件高度动态调整
  const maxCrushAmount = svgSpecimenHeight * 0.06; // 最大压缩量为试件高度的 6%
  const crushAmount = (status === TestStatus.RUNNING || status === TestStatus.FAILED) ? progress * maxCrushAmount : 0;
  
  // 总的向下位移
  const headTy = approachDistance + crushAmount;

  const isFailed = progress >= 0.99;
  const isNearFailure = progress >= 0.85;
  
  // 使用 ref 记录历史最大 progress，确保裂缝不会消失
  const maxProgressRef = useRef(0);
  if (progress > maxProgressRef.current) {
    maxProgressRef.current = progress;
  }
  // 试验重置时清零
  if (status === TestStatus.IDLE) {
    maxProgressRef.current = 0;
  }
  const crackProgress = maxProgressRef.current;
  const showCracks = crackProgress >= 0.6;
  
  const stressRatio = Math.min(progress, 1);
  
  // 振动效果
  const vibrationX = isNearFailure && status === TestStatus.RUNNING 
    ? (Math.random() - 0.5) * 3 * progress : 0;
  const vibrationY = isNearFailure && status === TestStatus.RUNNING 
    ? (Math.random() - 0.5) * 2 * progress : 0;

  // 液压油颜色 - 根据循环阶段变化
  const getHydraulicColor = () => {
    if (status !== TestStatus.RUNNING) return '#991b1b';
    if (controlMode === 'program') {
      switch (cyclePhase) {
        case 'loading': return '#dc2626'; // 红色 - 加载
        case 'unloading': return '#22c55e'; // 绿色 - 卸载
        case 'holding_upper':
        case 'holding_lower': return '#eab308'; // 黄色 - 保载
        case 'final': return '#ef4444'; // 亮红 - 最终破坏
        default: return '#dc2626';
      }
    }
    return '#dc2626';
  };
  const hydraulicColor = getHydraulicColor();
  
  // 指示灯状态
  const powerLightColor = status !== TestStatus.IDLE ? '#22c55e' : '#166534';
  const runLightColor = status === TestStatus.RUNNING ? '#eab308' : '#713f12';
  const errorLightColor = isFailed ? '#ef4444' : '#7f1d1d';
  
  // 程序控制模式下的方向指示
  const showDirectionArrow = controlMode === 'program' && status === TestStatus.RUNNING;
  const arrowDirection = cyclePhase === 'loading' || cyclePhase === 'final' ? 'down' : cyclePhase === 'unloading' ? 'up' : 'none';

  // 生成裂缝 - 基于 crackProgress 的确定性裂缝
  // 使用 crackProgress（历史最大值）确保裂缝只增不减
  const generatedCracks = useMemo(() => {
    if (!showCracks) return [];
    const cracks: string[] = [];
    // 裂缝数量随 crackProgress 增加
    const intensity = Math.floor((crackProgress - 0.6) / 0.05) + 1;
    
    // 预定义的裂缝起点和方向（使用百分比），确保可重复
    const crackSeeds = [
      { xPct: 0.20, fromTop: true, anglePct: 0.15 },
      { xPct: 0.80, fromTop: true, anglePct: -0.10 },
      { xPct: 0.50, fromTop: false, anglePct: 0.05 },
      { xPct: 0.35, fromTop: true, anglePct: -0.20 },
      { xPct: 0.65, fromTop: false, anglePct: 0.12 },
      { xPct: 0.15, fromTop: false, anglePct: -0.08 },
      { xPct: 0.85, fromTop: false, anglePct: 0.18 },
      { xPct: 0.45, fromTop: true, anglePct: -0.15 },
      { xPct: 0.55, fromTop: true, anglePct: 0.08 },
      { xPct: 0.30, fromTop: false, anglePct: -0.12 },
    ];
    
    for (let i = 0; i < Math.min(intensity, crackSeeds.length); i++) {
      const seed = crackSeeds[i];
      const startX = seed.xPct * svgSpecimenWidth;
      const startY = seed.fromTop ? 0 : svgSpecimenHeight;
      const length = (0.25 + i * 0.05) * svgSpecimenHeight; // 裂缝长度
      const endX = startX + seed.anglePct * svgSpecimenWidth;
      const endY = seed.fromTop ? length : svgSpecimenHeight - length;
      const midX = (startX + endX) / 2 + seed.anglePct * svgSpecimenWidth * 0.5;
      const midY = (startY + endY) / 2;
      
      cracks.push(`M ${startX} ${startY} Q ${midX} ${midY}, ${endX} ${endY}`);
    }
    return cracks;
  }, [showCracks, crackProgress, svgSpecimenWidth, svgSpecimenHeight]);

  // 使用预计算的尺寸（已在前面计算）
  const specimenHeight = svgSpecimenHeight;
  const specimenWidth = svgSpecimenWidth;
  const specimenBottomY = lowerPlatenY; // 试件底部紧贴下压板顶部

  return (
    <svg 
      viewBox="0 0 400 520" 
      className="w-full h-full select-none" 
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="column-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="15%" stopColor="#475569" />
          <stop offset="30%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#e2e8f0" />
          <stop offset="70%" stopColor="#94a3b8" />
          <stop offset="85%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="dark-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="30%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="piston-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="25%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="75%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>

        <linearGradient id="cylinder-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="20%" stopColor="#1e293b" />
          <stop offset="80%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* FEM 颜色条渐变 - Jet colormap */}
        <linearGradient id="fem-colorbar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgb(0, 0, 255)" />
          <stop offset="25%" stopColor="rgb(0, 255, 255)" />
          <stop offset="50%" stopColor="rgb(0, 255, 0)" />
          <stop offset="75%" stopColor="rgb(255, 255, 0)" />
          <stop offset="100%" stopColor="rgb(255, 0, 0)" />
        </linearGradient>

        <filter id="concrete-texture" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" seed="5"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="mono"/>
          <feBlend in="SourceGraphic" in2="mono" mode="multiply"/>
        </filter>

        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.5"/>
        </filter>

        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 背景 */}
      <rect width="400" height="520" fill="#0f172a" />
      
      {/* 背景网格 */}
      <g opacity="0.1">
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 30} x2="400" y2={i * 30} stroke="#334155" strokeWidth="0.5"/>
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="520" stroke="#334155" strokeWidth="0.5"/>
        ))}
      </g>

      {/* ========== 固定框架 ========== */}
      
      {/* 底座 */}
      <g transform="translate(30, 455)" onClick={onMachineClick} style={{ cursor: 'pointer' }}>
        <rect x="0" y="0" width="340" height="50" rx="3" fill="url(#dark-metal)" filter="url(#drop-shadow)"/>
        <rect x="0" y="5" width="340" height="3" fill="#475569" opacity="0.5"/>
        <rect x="20" y="12" width="300" height="5" fill="#0f172a" rx="1"/>
        <rect x="20" y="28" width="300" height="5" fill="#0f172a" rx="1"/>
        <g transform="translate(140, 14)">
          <rect x="0" y="0" width="60" height="20" rx="2" fill="#000" stroke="#333" strokeWidth="1"/>
          <text x="30" y="14" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="Arial Black" fontWeight="bold">MTS</text>
        </g>
      </g>

      {/* 立柱 */}
      <rect x="50" y="60" width="45" height="395" fill="url(#column-grad)" rx="3"/>
      <rect x="305" y="60" width="45" height="395" fill="url(#column-grad)" rx="3"/>
      <rect x="45" y="445" width="55" height="12" fill="#1e293b" rx="2"/>
      <rect x="300" y="445" width="55" height="12" fill="#1e293b" rx="2"/>
      <rect x="45" y="55" width="55" height="12" fill="#1e293b" rx="2"/>
      <rect x="300" y="55" width="55" height="12" fill="#1e293b" rx="2"/>

      {/* 顶部横梁 */}
      <g transform="translate(30, 30)">
        <rect x="0" y="0" width="340" height="70" rx="5" fill="url(#dark-metal)" filter="url(#drop-shadow)"/>
        <rect x="0" y="25" width="340" height="12" fill="#2563eb"/>
        <rect x="0" y="25" width="340" height="2" fill="#3b82f6"/>
      </g>

      {/* 控制面板 - 放在右侧立柱旁边 */}
      <g transform="translate(352, 100)">
        <rect x="0" y="0" width="32" height="100" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
        <g transform="translate(16, 18)">
          <circle r="5" fill={powerLightColor} filter="url(#glow)"/>
          <text y="12" textAnchor="middle" fill="#64748b" fontSize="5">PWR</text>
        </g>
        <g transform="translate(16, 48)">
          <circle r="5" fill={runLightColor} filter={status === TestStatus.RUNNING ? "url(#glow)" : ""}/>
          <text y="12" textAnchor="middle" fill="#64748b" fontSize="5">RUN</text>
        </g>
        <g transform="translate(16, 78)">
          <circle r="5" fill={errorLightColor} filter={isFailed ? "url(#glow)" : ""}/>
          <text y="12" textAnchor="middle" fill="#64748b" fontSize="5">ERR</text>
        </g>
      </g>

      {/* 液压缸（固定在横梁下方） */}
      <g transform="translate(155, 100)">
        <rect x="0" y="0" width="90" height="80" rx="3" fill="url(#cylinder-grad)" stroke="#334155" strokeWidth="1"/>
        <rect x="5" y="10" width="80" height="5" fill="#0f172a"/>
        <rect x="5" y="65" width="80" height="5" fill="#0f172a"/>
        <rect x="70" y="25" width="12" height="30" rx="2" fill="#0f172a" stroke="#333"/>
        <rect x="72" y="27" width="8" height={26 * (status === TestStatus.RUNNING ? 0.8 : 0.3)} rx="1" fill={hydraulicColor}>
          {status === TestStatus.RUNNING && (
            <animate attributeName="height" values={`${26 * 0.7};${26 * 0.9};${26 * 0.7}`} dur="0.5s" repeatCount="indefinite"/>
          )}
        </rect>
        <rect x="-8" y="30" width="10" height="15" rx="2" fill="#475569"/>
        <rect x="88" y="30" width="10" height="15" rx="2" fill="#475569"/>
      </g>

      {/* ========== 下部固定件（试件和下压板） ========== */}
      
      {/* 下压板 - 固定位置 */}
      <rect x="135" y={lowerPlatenY} width="130" height="18" fill="#94a3b8" stroke="#64748b" strokeWidth="1" rx="2"/>
      <rect x="140" y={lowerPlatenY + 2} width="120" height="3" fill="#cbd5e1"/>

      {/* 劈裂试验下夹具 */}
      {testType === TestType.TENSION && (
        <g transform={`translate(200, ${lowerPlatenY - 17})`}>
          <rect x="-8" y="0" width="16" height="12" fill="#334155" rx="1"/>
          <rect x="-10" y="12" width="20" height="5" fill="#d4a373" stroke="#92400e" strokeWidth="0.5"/>
        </g>
      )}

      {/* 试件 - 固定在下压板上 */}
      {(testType === TestType.COMPRESSION || testType === TestType.ELASTIC_MODULUS) && (
        <g 
          transform={`translate(${200 - specimenWidth / 2 + vibrationX}, ${specimenTopY + vibrationY})`}
          onClick={onSpecimenClick}
          style={{ cursor: 'pointer' }}
        >
          {/* FEM 云图或普通试件主体 */}
          {showFEMContour && femMesh && femResult ? (
            <g>
              {/* FEM 单元云图 - 显示 Y 方向应力（压缩方向）*/}
              {femMesh.elements.map(element => {
                const elemResult = femResult.elements.find(e => e.elementId === element.id);
                // 使用 σy 的绝对值（压缩应力为负，取绝对值显示）
                const value = elemResult ? Math.abs(elemResult.sigmaY) : 0;
                const color = getContourColor(value, femMinValue, femMaxValue);
                
                // 获取单元节点坐标并转换到 SVG 坐标
                const nodes = element.nodes.map(nid => femMesh.nodes.find(n => n.id === nid)!);
                const scaleX = specimenWidth / specimenW;
                const scaleY = specimenHeight / specimenH;
                
                // 四边形路径 (注意 Y 坐标需要翻转)
                const points = nodes.map(n => 
                  `${n.x * scaleX},${specimenHeight - n.y * scaleY}`
                ).join(' ');
                
                return (
                  <polygon 
                    key={element.id}
                    points={points}
                    fill={color}
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="0.3"
                  />
                );
              })}
            </g>
          ) : (
            <rect 
              x="0" y="0" width={specimenWidth} height={specimenHeight} 
              fill={`rgb(${175 - stressRatio * 20}, ${170 - stressRatio * 20}, ${165 - stressRatio * 20})`}
              filter="url(#concrete-texture)"
              rx="2"
            />
          )}
          
          {/* 边缘效果 */}
          <rect x="0" y="0" width={specimenWidth} height="3" fill="#a8a29e" opacity="0.3"/>
          <rect x="0" y="0" width="3" height={specimenHeight} fill="#a8a29e" opacity="0.2"/>
          <rect x={specimenWidth - 3} y="3" width="3" height={specimenHeight - 3} fill="#57534e" opacity="0.3"/>
          <rect x="3" y={specimenHeight - 3} width={specimenWidth - 3} height="3" fill="#57534e" opacity="0.3"/>

          {/* 裂缝 - 使用 crackProgress 确保裂缝不会消失 */}
          {showCracks && (useExternalCracks ? crackPaths : generatedCracks).map((path: string, i: number) => (
            <g key={i}>
              {/* 裂缝阴影/发光效果 */}
              <path 
                d={path} 
                stroke="#000000" 
                strokeWidth={2 + (crackProgress - 0.6) * 5}
                fill="none"
                opacity={0.4}
                strokeLinecap="round"
              />
              {/* 主裂缝 */}
              <path 
                d={path} 
                stroke="#1c1917" 
                strokeWidth={1.5 + (crackProgress - 0.6) * 4}
                fill="none"
                opacity={Math.min((crackProgress - 0.6) / 0.3 + 0.4, 1)}
                strokeLinecap="round"
              />
              {/* 裂缝高光（模拟深度） */}
              <path 
                d={path} 
                stroke="#a8a29e" 
                strokeWidth={0.8}
                fill="none"
                opacity={0.6}
                strokeLinecap="round"
                transform="translate(0.5, 0.5)"
              />
            </g>
          ))}

          {/* 破坏效果 */}
          {isFailed && (
            <g>
              <path d={`M 0 0 L ${specimenWidth * 0.4} ${specimenHeight / 2} L 0 ${specimenHeight}`} stroke="#1a1a1a" strokeWidth="4" fill="none"/>
              <path d={`M ${specimenWidth} 0 L ${specimenWidth * 0.6} ${specimenHeight / 2} L ${specimenWidth} ${specimenHeight}`} stroke="#1a1a1a" strokeWidth="4" fill="none"/>
              <polygon points="-15,35 -5,45 -12,60" fill="#78716c" transform="translate(-8, 5)"/>
              <polygon points="115,30 105,43 112,55" fill="#78716c" transform={`translate(${specimenWidth - 85}, 5)`}/>
              <ellipse cx={specimenWidth / 2} cy={specimenHeight + 15} rx={specimenWidth / 4} ry="6" fill="#6b6560"/>
            </g>
          )}

          {/* 标签 - 仅在无云图时显示 */}
          {!showFEMContour || !femResult ? (
            <g transform={`translate(${specimenWidth / 2}, ${specimenHeight / 2})`}>
              <rect x="-25" y="-10" width="50" height="20" fill="#fff" opacity="0.9" rx="2"/>
              <text textAnchor="middle" y="5" fontSize="8" fill="#334155" fontFamily="monospace">{specimenLabel}</text>
            </g>
          ) : null}
        </g>
      )}
      
      {/* FEM 颜色条 - 显示在试件右侧 */}
      {showFEMContour && femResult && (testType === TestType.COMPRESSION || testType === TestType.ELASTIC_MODULUS) && (
        <g transform={`translate(${200 + specimenWidth / 2 + 15}, ${specimenTopY})`}>
          {/* 颜色条背景 */}
          <rect x="0" y="0" width="12" height={specimenHeight} fill="url(#fem-colorbar)" rx="1"/>
          <rect x="0" y="0" width="12" height={specimenHeight} fill="none" stroke="#475569" strokeWidth="0.5" rx="1"/>
          
          {/* 刻度标签 */}
          <text x="16" y="8" fontSize="6" fill="#94a3b8" fontFamily="monospace">{femMaxValue.toFixed(1)}</text>
          <text x="16" y={specimenHeight / 2 + 2} fontSize="6" fill="#94a3b8" fontFamily="monospace">{((femMaxValue + femMinValue) / 2).toFixed(1)}</text>
          <text x="16" y={specimenHeight - 2} fontSize="6" fill="#94a3b8" fontFamily="monospace">{femMinValue.toFixed(1)}</text>
          
          {/* 标题 */}
          <text x="6" y={specimenHeight + 12} fontSize="6" fill="#64748b" fontFamily="monospace" textAnchor="middle">σy</text>
          <text x="6" y={specimenHeight + 20} fontSize="5" fill="#64748b" fontFamily="monospace" textAnchor="middle">MPa</text>
        </g>
      )}

      {/* 劈裂试件 - 圆柱体 */}
      {testType === TestType.TENSION && (
        <g 
          transform={`translate(${200 + vibrationX}, ${specimenTopY + 50 + vibrationY})`}
          onClick={onSpecimenClick}
          style={{ cursor: 'pointer' }}
        >
          <ellipse cx="0" cy="-50" rx="50" ry="12" fill="#a8a29e"/>
          <rect x="-50" y="-50" width="100" height="100" 
            fill={`rgb(${175 - stressRatio * 20}, ${170 - stressRatio * 20}, ${165 - stressRatio * 20})`} 
            filter="url(#concrete-texture)"/>
          <ellipse cx="0" cy="50" rx="50" ry="12" fill="#8a8580"/>
          
          <line x1="0" y1="-50" x2="0" y2="50" stroke="#fff" strokeWidth="1" strokeDasharray="4 4" opacity="0.3"/>

          {showCracks && (
            <line 
              x1="0" y1={-50 + (1 - (progress - 0.6) / 0.4) * 50} 
              x2="0" y2={50 - (1 - (progress - 0.6) / 0.4) * 50}
              stroke="#292524" 
              strokeWidth={1 + (progress - 0.6) * 6}
              strokeLinecap="round"
            />
          )}

          {isFailed && (
            <g>
              <line x1="0" y1="-50" x2="0" y2="50" stroke="#1a1a1a" strokeWidth="8"/>
              <ellipse cx="0" cy="60" rx="20" ry="5" fill="#6b6560"/>
            </g>
          )}
        </g>
      )}

      {/* ========== 活塞杆（从液压缸伸出，长度随位移变化） ========== */}
      {/* 活塞杆顶部固定在液压缸底部 Y=180，底部连接荷载传感器顶部 */}
      {(() => {
        const pistonTop = 180; // 活塞杆顶部（液压缸底部）
        // 荷载传感器在移动组内 Y=200，移动组偏移 headTy
        // 活塞杆底部需要到达 200 + headTy
        // 所以活塞杆长度 = (200 + headTy) - 180 = 20 + headTy
        const basePistonLength = 20; // 基础长度
        const pistonLength = basePistonLength + headTy; // 实际长度随位移增加
        return (
          <g>
            <rect x="175" y={pistonTop} width="50" height={pistonLength} fill="url(#piston-grad)" rx="2"/>
            <rect x="195" y={pistonTop} width="8" height={pistonLength} fill="#fff" opacity="0.2"/>
          </g>
        );
      })()}

      {/* ========== 移动部件（随 headTy 向下移动） ========== */}
      {/* 
        结构从上到下：
        1. 荷载传感器 Y=200（连接活塞杆底部 Y=200）
        2. 球铰座 Y=228
        3. 上压板 Y=260（底部 Y=278）
        试件顶部=330，接触时需要移动: 330 - 278 = 52
      */}
      <g transform={`translate(0, ${headTy})`}>
        
        {/* 荷载传感器 - 连接活塞杆底部 Y=200 */}
        <g transform="translate(155, 200)">
          <rect x="0" y="0" width="90" height="28" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" filter="url(#drop-shadow)"/>
          <rect x="5" y="4" width="80" height="20" rx="3" fill="#f8fafc"/>
          <text x="45" y="18" textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#334155" fontWeight="bold">100kN</text>
          <rect x="85" y="8" width="10" height="10" rx="2" fill="#1e293b"/>
          <path d="M 95 13 Q 108 13, 113 25 Q 118 37, 125 42" stroke="#1e293b" strokeWidth="2" fill="none"/>
        </g>

        {/* 球铰座 - 在荷载传感器下方，上压板上方 */}
        <g transform="translate(160, 228)">
          {/* 上部连接块 */}
          <rect x="5" y="0" width="70" height="10" fill="#475569" rx="2"/>
          {/* 球形部分 */}
          <ellipse cx="40" cy="15" rx="20" ry="8" fill="#64748b"/>
          <ellipse cx="40" cy="15" rx="15" ry="5" fill="#94a3b8"/>
          {/* 下部座 */}
          <rect x="0" y="22" width="80" height="10" fill="#475569" rx="2"/>
        </g>

        {/* 上压板 - 在球铰座下方，接触试件 */}
        {/* 球铰座底部 Y=228+32=260，上压板从 Y=260 开始，底部 Y=278 */}
        <g transform="translate(135, 260)">
          <rect x="0" y="0" width="130" height="18" fill="#94a3b8" stroke="#64748b" strokeWidth="1" rx="2"/>
          <rect x="5" y="2" width="120" height="3" fill="#cbd5e1"/>
        </g>

        {/* 劈裂试验上夹具 - 在上压板下方 Y=278 */}
        {testType === TestType.TENSION && (
          <g transform="translate(200, 278)">
            <rect x="-8" y="0" width="16" height="10" fill="#334155" rx="1"/>
            <rect x="-10" y="10" width="20" height="4" fill="#d4a373" stroke="#92400e" strokeWidth="0.5"/>
          </g>
        )}
      </g>

      {/* ========== 安全门 ========== */}
      {!safetyDoorOpen && (
        <g opacity="0.2">
          <rect x="45" y="100" width="310" height="345" fill="#64748b" rx="5"/>
          <pattern id="mesh" patternUnits="userSpaceOnUse" width="15" height="15">
            <path d="M 0 0 L 15 15 M 15 0 L 0 15" stroke="#334155" strokeWidth="1"/>
          </pattern>
          <rect x="45" y="100" width="310" height="345" fill="url(#mesh)"/>
          <rect x="45" y="100" width="310" height="345" stroke="#eab308" strokeWidth="3" strokeDasharray="20 10" fill="none" rx="5"/>
          <g transform="translate(200, 270)">
            <polygon points="0,-30 26,15 -26,15" fill="#eab308" stroke="#000" strokeWidth="2"/>
            <text y="5" textAnchor="middle" fontSize="24" fill="#000" fontWeight="bold">!</text>
          </g>
        </g>
      )}

      {/* ========== 程序控制模式 - 方向指示器 ========== */}
      {showDirectionArrow && arrowDirection !== 'none' && (
        <g transform="translate(15, 280)">
          {/* 背景框 */}
          <rect x="0" y="-30" width="28" height="60" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
          
          {/* 方向箭头 */}
          {arrowDirection === 'down' ? (
            <g>
              <path 
                d="M 14 -15 L 14 15 M 8 9 L 14 18 L 20 9" 
                stroke={cyclePhase === 'final' ? '#ef4444' : '#dc2626'} 
                strokeWidth="3" 
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite"/>
              </path>
              <text x="14" y="35" textAnchor="middle" fill="#dc2626" fontSize="6" fontFamily="monospace">
                {cyclePhase === 'final' ? 'FAIL' : 'LOAD'}
              </text>
            </g>
          ) : (
            <g>
              <path 
                d="M 14 15 L 14 -15 M 8 -9 L 14 -18 L 20 -9" 
                stroke="#22c55e" 
                strokeWidth="3" 
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite"/>
              </path>
              <text x="14" y="35" textAnchor="middle" fill="#22c55e" fontSize="6" fontFamily="monospace">UNLD</text>
            </g>
          )}
        </g>
      )}

      {/* 保载状态指示 */}
      {showDirectionArrow && (cyclePhase === 'holding_upper' || cyclePhase === 'holding_lower') && (
        <g transform="translate(15, 280)">
          <rect x="0" y="-30" width="28" height="60" rx="4" fill="#1e293b" stroke="#eab308" strokeWidth="1">
            <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/>
          </rect>
          <text x="14" y="5" textAnchor="middle" fill="#eab308" fontSize="10" fontFamily="monospace" fontWeight="bold">
            ⏸
          </text>
          <text x="14" y="35" textAnchor="middle" fill="#eab308" fontSize="6" fontFamily="monospace">HOLD</text>
        </g>
      )}

      {/* ========== 应力/应变实时显示 ========== */}
      {status === TestStatus.RUNNING && (
        <g transform="translate(355, 220)">
          <rect x="0" y="0" width="40" height="80" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1"/>
          
          {/* 应力条 */}
          <rect x="5" y="10" width="12" height="60" rx="2" fill="#1e293b"/>
          <rect 
            x="5" 
            y={10 + 60 * (1 - Math.min(stressRatio, 1))} 
            width="12" 
            height={60 * Math.min(stressRatio, 1)} 
            rx="2" 
            fill={stressRatio > 0.9 ? '#ef4444' : stressRatio > 0.7 ? '#f59e0b' : '#22c55e'}
          >
            {stressRatio > 0.8 && (
              <animate attributeName="opacity" values="1;0.6;1" dur="0.3s" repeatCount="indefinite"/>
            )}
          </rect>
          <text x="11" y="78" textAnchor="middle" fill="#64748b" fontSize="5" fontFamily="monospace">σ</text>
          
          {/* 进度条 */}
          <rect x="23" y="10" width="12" height="60" rx="2" fill="#1e293b"/>
          <rect 
            x="23" 
            y={10 + 60 * (1 - progress)} 
            width="12" 
            height={60 * progress} 
            rx="2" 
            fill={progress > 0.9 ? '#ef4444' : progress > 0.7 ? '#f59e0b' : '#3b82f6'}
          />
          <text x="29" y="78" textAnchor="middle" fill="#64748b" fontSize="5" fontFamily="monospace">ε</text>
        </g>
      )}

    </svg>
  );
};
