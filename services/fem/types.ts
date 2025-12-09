/**
 * 有限元分析类型定义
 * FEM Analysis Type Definitions
 */

// 节点 Node
export interface Node {
  id: number;
  x: number;  // x 坐标
  y: number;  // y 坐标
  // 自由度约束 (true = 固定)
  fixedX?: boolean;
  fixedY?: boolean;
}

// 单元 Element (4节点四边形)
export interface Element {
  id: number;
  nodes: [number, number, number, number]; // 节点ID (逆时针)
  materialId: number;
}

// 材料属性
export interface Material {
  id: number;
  name: string;
  E: number;      // 弹性模量 (MPa)
  nu: number;     // 泊松比
  rho?: number;   // 密度 (kg/m³)
  fc?: number;    // 抗压强度 (MPa)
  ft?: number;    // 抗拉强度 (MPa)
  epsilon0?: number;  // 峰值应变
  epsilonU?: number;  // 极限应变
  constitutive?: 'linear' | 'hognestad' | 'gb50010' | 'damage' | 'mander' | 'eurocode' | 'steel' | 'rock'; // 本构模型类型
}

// 载荷类型
export type LoadType = 'force' | 'pressure' | 'displacement';

// 节点载荷
export interface NodalLoad {
  nodeId: number;
  fx?: number;  // x方向力 (N)
  fy?: number;  // y方向力 (N)
}

// 边界压力载荷
export interface PressureLoad {
  elementId: number;
  edge: 0 | 1 | 2 | 3;  // 单元边 (0=底, 1=右, 2=顶, 3=左)
  pressure: number;      // 压力 (MPa)
}

// 位移边界条件
export interface DisplacementBC {
  nodeId: number;
  ux?: number;  // x方向位移 (mm)
  uy?: number;  // y方向位移 (mm)
}

// 网格数据
export interface Mesh {
  nodes: Node[];
  elements: Element[];
  materials: Material[];
}

// 求解结果 - 节点
export interface NodeResult {
  nodeId: number;
  ux: number;  // x位移 (mm)
  uy: number;  // y位移 (mm)
}

// 求解结果 - 单元
export interface ElementResult {
  elementId: number;
  // 应力 (MPa)
  sigmaX: number;   // σx
  sigmaY: number;   // σy
  tauXY: number;    // τxy
  // 主应力
  sigma1: number;   // 最大主应力
  sigma2: number;   // 最小主应力
  vonMises: number; // von Mises 等效应力
  // 应变
  epsilonX: number;
  epsilonY: number;
  gammaXY: number;
}

// 完整求解结果
export interface FEMResult {
  nodes: NodeResult[];
  elements: ElementResult[];
  maxDisplacement: number;
  maxStress: number;
  maxVonMises: number;
  converged: boolean;
  iterations?: number;
}

// 分析类型
export type AnalysisType = 'plane_stress' | 'plane_strain';

// 分析配置
export interface AnalysisConfig {
  type: AnalysisType;
  mesh: Mesh;
  nodalLoads: NodalLoad[];
  pressureLoads?: PressureLoad[];
  displacementBCs?: DisplacementBC[];
}

// 云图显示类型
export type ContourType = 
  | 'displacement_x'
  | 'displacement_y'
  | 'displacement_mag'
  | 'stress_x'
  | 'stress_y'
  | 'stress_xy'
  | 'stress_1'    // 主应力1
  | 'stress_2'    // 主应力2
  | 'von_mises'
  | 'strain_x'
  | 'strain_y';

// 颜色映射
export interface ColorMap {
  name: string;
  colors: string[];  // 从低到高的颜色数组
}

// 预定义颜色映射
export const COLOR_MAPS: Record<string, ColorMap> = {
  jet: {
    name: 'Jet',
    colors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
  },
  rainbow: {
    name: 'Rainbow',
    colors: ['#7f00ff', '#0000ff', '#00ff00', '#ffff00', '#ff7f00', '#ff0000']
  },
  coolwarm: {
    name: 'Cool-Warm',
    colors: ['#3b4cc0', '#7092c0', '#aac7fd', '#dddddd', '#f7a789', '#c94741', '#b40426']
  },
  viridis: {
    name: 'Viridis',
    colors: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']
  }
};
