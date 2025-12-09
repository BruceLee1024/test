export enum TestType {
  COMPRESSION = 'COMPRESSION',
  TENSION = 'TENSION', // Splitting Tensile (Brazilian)
  ELASTIC_MODULUS = 'ELASTIC_MODULUS' // 弹性模量测定
}

// 材料类型
export enum MaterialType {
  CONCRETE = 'CONCRETE',           // 普通混凝土
  HPC = 'HPC',                     // 高性能混凝土 High Performance Concrete
  FRC = 'FRC',                     // 纤维增强混凝土 Fiber Reinforced Concrete
  LAC = 'LAC',                     // 轻骨料混凝土 Lightweight Aggregate Concrete
  SCC = 'SCC',                     // 自密实混凝土 Self-Compacting Concrete
  STEEL = 'STEEL',                 // 钢材
  ROCK = 'ROCK',                   // 岩石
  MORTAR = 'MORTAR',               // 砂浆
  BRICK = 'BRICK',                 // 砖块
}

// 试块形状
export enum SpecimenShape {
  CUBE = 'CUBE',                   // 立方体
  CYLINDER = 'CYLINDER',           // 圆柱体
  PRISM = 'PRISM',                 // 棱柱体
}

// 试块尺寸预设
export interface SpecimenSize {
  shape: SpecimenShape;
  name: string;
  dimensions: {
    width?: number;   // mm (立方体边长或棱柱体宽度)
    height: number;   // mm (高度)
    depth?: number;   // mm (棱柱体深度)
    diameter?: number; // mm (圆柱体直径)
  };
  area: number;       // mm² (承压面积)
  standard: string;   // 标准规范
}

export enum TestStatus {
  IDLE = 'IDLE',
  APPROACHING = 'APPROACHING', // Head moving down
  RUNNING = 'RUNNING',         // Load being applied
  PAUSED = 'PAUSED',
  FAILED = 'FAILED'
}

export interface DataPoint {
  time: number;
  load: number; // kN
  stress: number; // MPa
  strain: number; // Unitless (simplified for viz)
}

export interface SimulationParams {
  maxLoad: number; // kN (Target failure load approx)
  loadingRate: number; // kN/s
  sampleArea: number; // mm^2
  sampleName: string;
}

export interface CrackPath {
  d: string;
  id: number;
  delayFactor: number; // 0-1, when it should start appearing relative to failure
}