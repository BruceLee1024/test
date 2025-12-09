/**
 * 材料本构模型库
 * 支持：混凝土、钢材、岩石、砂浆、砖块
 */

import { MaterialType, SpecimenShape, SpecimenSize } from '../types';
import { ConstitutiveModelType } from './settingsService';

// ==================== 通用接口 ====================

export interface MaterialProperties {
  type: MaterialType;
  name: string;
  fc: number;         // 抗压强度 (MPa)
  ft: number;         // 抗拉强度 (MPa)
  E: number;          // 弹性模量 (MPa)
  epsilon0: number;   // 峰值应变
  epsilonU: number;   // 极限应变
  nu: number;         // 泊松比
  constitutiveModel?: ConstitutiveModelType; // 本构模型类型
}

// 保持向后兼容
export interface ConcreteProperties extends MaterialProperties {
  fcu: number;        // 立方体抗压强度 (MPa)
  Ec: number;         // 弹性模量 (MPa) - 别名
  constitutiveModel?: ConstitutiveModelType; // 本构模型类型
}

export interface StressStrainPoint {
  strain: number;
  stress: number;
  phase: 'seating' | 'elastic' | 'plastic' | 'peak' | 'softening' | 'failed';
}

// ==================== 试块尺寸预设 ====================

export const SPECIMEN_SIZES: SpecimenSize[] = [
  // 立方体
  { shape: SpecimenShape.CUBE, name: '150mm 标准立方体', dimensions: { width: 150, height: 150 }, area: 22500, standard: 'GB/T 50081' },
  { shape: SpecimenShape.CUBE, name: '100mm 立方体', dimensions: { width: 100, height: 100 }, area: 10000, standard: 'GB/T 50081' },
  { shape: SpecimenShape.CUBE, name: '70.7mm 立方体', dimensions: { width: 70.7, height: 70.7 }, area: 5000, standard: 'JGJ/T 70' },
  
  // 圆柱体
  { shape: SpecimenShape.CYLINDER, name: 'Φ150×300 标准圆柱', dimensions: { diameter: 150, height: 300 }, area: 17671, standard: 'ASTM C39' },
  { shape: SpecimenShape.CYLINDER, name: 'Φ100×200 圆柱', dimensions: { diameter: 100, height: 200 }, area: 7854, standard: 'ASTM C39' },
  { shape: SpecimenShape.CYLINDER, name: 'Φ75×150 圆柱', dimensions: { diameter: 75, height: 150 }, area: 4418, standard: 'ASTM C39' },
  
  // 棱柱体
  { shape: SpecimenShape.PRISM, name: '150×150×300 棱柱体', dimensions: { width: 150, depth: 150, height: 300 }, area: 22500, standard: 'GB/T 50081' },
  { shape: SpecimenShape.PRISM, name: '100×100×300 棱柱体', dimensions: { width: 100, depth: 100, height: 300 }, area: 10000, standard: 'GB/T 50081' },
  { shape: SpecimenShape.PRISM, name: '150×150×450 棱柱体', dimensions: { width: 150, depth: 150, height: 450 }, area: 22500, standard: 'ASTM C469' },
];

// ==================== 材料属性生成 ====================

/**
 * 根据材料类型和目标强度生成材料属性
 */
export function generateMaterialProperties(
  materialType: MaterialType,
  targetStrength: number,
  randomSeed?: number
): MaterialProperties {
  const random = randomSeed !== undefined ? seededRandom(randomSeed) : Math.random;
  const cv = 0.12; // 变异系数
  
  switch (materialType) {
    case MaterialType.CONCRETE:
      return generateConcreteProps(targetStrength, random, cv);
    case MaterialType.HPC:
      return generateHPCProps(targetStrength, random, cv);
    case MaterialType.FRC:
      return generateFRCProps(targetStrength, random, cv);
    case MaterialType.LAC:
      return generateLACProps(targetStrength, random, cv);
    case MaterialType.SCC:
      return generateSCCProps(targetStrength, random, cv);
    case MaterialType.STEEL:
      return generateSteelProps(targetStrength, random, cv);
    case MaterialType.ROCK:
      return generateRockProps(targetStrength, random, cv);
    case MaterialType.MORTAR:
      return generateMortarProps(targetStrength, random, cv);
    case MaterialType.BRICK:
      return generateBrickProps(targetStrength, random, cv);
    default:
      return generateConcreteProps(targetStrength, random, cv);
  }
}

// 混凝土属性生成
function generateConcreteProps(targetFcu: number, random: () => number, cv: number): MaterialProperties {
  const actualFcu = targetFcu * (1 + gaussianRandom(random) * cv);
  const fc = actualFcu * 0.76;
  const E = 4730 * Math.sqrt(fc) * (0.9 + random() * 0.2);
  const epsilon0 = 0.002 + (actualFcu - 30) * 0.00001;
  const epsilonU = 0.0033 + random() * 0.0005;
  const ft = actualFcu * (0.08 + random() * 0.04);
  
  return {
    type: MaterialType.CONCRETE,
    name: `C${Math.round(targetFcu)} 混凝土`,
    fc: actualFcu,
    ft,
    E,
    epsilon0: Math.max(0.0018, Math.min(0.0025, epsilon0)),
    epsilonU,
    nu: 0.2,
  };
}

// 高性能混凝土 (HPC) 属性生成
// 特点：高强度、高弹性模量、低变异性、脆性较大
function generateHPCProps(targetFcu: number, random: () => number, cv: number): MaterialProperties {
  const actualFcu = targetFcu * (1 + gaussianRandom(random) * cv * 0.7); // 变异性较小
  const fc = actualFcu * 0.80; // 换算系数略高
  const E = 5500 * Math.sqrt(fc) * (0.95 + random() * 0.1); // 弹性模量更高
  const epsilon0 = 0.0022 + (actualFcu - 60) * 0.000005; // 峰值应变略大
  const epsilonU = 0.0028 + random() * 0.0003; // 极限应变较小（更脆）
  const ft = actualFcu * (0.06 + random() * 0.02); // 抗拉强度比例略低
  
  return {
    type: MaterialType.HPC,
    name: `HPC${Math.round(targetFcu)} 高性能混凝土`,
    fc: actualFcu,
    ft,
    E,
    epsilon0: Math.max(0.0020, Math.min(0.0028, epsilon0)),
    epsilonU,
    nu: 0.18,
  };
}

// 纤维增强混凝土 (FRC) 属性生成
// 特点：韧性好、抗裂性强、延性大、峰后承载能力强
function generateFRCProps(targetFcu: number, random: () => number, cv: number): MaterialProperties {
  const actualFcu = targetFcu * (1 + gaussianRandom(random) * cv * 0.9);
  const fc = actualFcu * 0.78;
  const E = 4500 * Math.sqrt(fc) * (0.9 + random() * 0.2); // 弹性模量略低
  const epsilon0 = 0.0025 + (actualFcu - 30) * 0.00001; // 峰值应变较大
  const epsilonU = 0.006 + random() * 0.002; // 极限应变大（延性好）
  const ft = actualFcu * (0.12 + random() * 0.06); // 抗拉强度显著提高
  
  return {
    type: MaterialType.FRC,
    name: `FRC${Math.round(targetFcu)} 纤维混凝土`,
    fc: actualFcu,
    ft,
    E,
    epsilon0: Math.max(0.0022, Math.min(0.0030, epsilon0)),
    epsilonU,
    nu: 0.20,
  };
}

// 轻骨料混凝土 (LAC) 属性生成
// 特点：密度低、弹性模量低、脆性较大
function generateLACProps(targetFcu: number, random: () => number, cv: number): MaterialProperties {
  const actualFcu = targetFcu * (1 + gaussianRandom(random) * cv * 1.1); // 变异性略大
  const fc = actualFcu * 0.74;
  const E = 3200 * Math.sqrt(fc) * (0.85 + random() * 0.3); // 弹性模量显著降低
  const epsilon0 = 0.0022 + random() * 0.0004; // 峰值应变
  const epsilonU = 0.0030 + random() * 0.0004; // 极限应变较小
  const ft = actualFcu * (0.07 + random() * 0.03);
  
  return {
    type: MaterialType.LAC,
    name: `LC${Math.round(targetFcu)} 轻骨料混凝土`,
    fc: actualFcu,
    ft,
    E,
    epsilon0: Math.max(0.0020, Math.min(0.0028, epsilon0)),
    epsilonU,
    nu: 0.22,
  };
}

// 自密实混凝土 (SCC) 属性生成
// 特点：流动性好、均匀性好、变异性小
function generateSCCProps(targetFcu: number, random: () => number, cv: number): MaterialProperties {
  const actualFcu = targetFcu * (1 + gaussianRandom(random) * cv * 0.8); // 变异性较小
  const fc = actualFcu * 0.77;
  const E = 4600 * Math.sqrt(fc) * (0.92 + random() * 0.16); // 弹性模量略低
  const epsilon0 = 0.0021 + (actualFcu - 30) * 0.000008;
  const epsilonU = 0.0034 + random() * 0.0004;
  const ft = actualFcu * (0.085 + random() * 0.035);
  
  return {
    type: MaterialType.SCC,
    name: `SCC${Math.round(targetFcu)} 自密实混凝土`,
    fc: actualFcu,
    ft,
    E,
    epsilon0: Math.max(0.0019, Math.min(0.0026, epsilon0)),
    epsilonU,
    nu: 0.19,
  };
}

// 钢材属性生成 (理想弹塑性模型)
function generateSteelProps(targetFy: number, random: () => number, cv: number): MaterialProperties {
  const actualFy = targetFy * (1 + gaussianRandom(random) * cv * 0.5); // 钢材变异较小
  const E = 206000 * (0.98 + random() * 0.04); // 弹性模量约 206 GPa
  const epsilon0 = actualFy / E; // 屈服应变
  const epsilonU = 0.15 + random() * 0.05; // 极限应变 15-20%
  const ft = actualFy * (1.2 + random() * 0.3); // 抗拉强度约为屈服强度的 1.2-1.5 倍
  
  return {
    type: MaterialType.STEEL,
    name: `Q${Math.round(targetFy)} 钢材`,
    fc: actualFy,
    ft,
    E,
    epsilon0,
    epsilonU,
    nu: 0.3,
  };
}

// 岩石属性生成 (脆性材料)
function generateRockProps(targetFc: number, random: () => number, cv: number): MaterialProperties {
  const actualFc = targetFc * (1 + gaussianRandom(random) * cv * 1.5); // 岩石变异较大
  const E = 20000 + actualFc * 500 * (0.8 + random() * 0.4); // 弹性模量与强度相关
  const epsilon0 = 0.001 + actualFc * 0.00001; // 峰值应变较小
  const epsilonU = epsilon0 * (1.2 + random() * 0.3); // 脆性，极限应变接近峰值
  const ft = actualFc * (0.05 + random() * 0.05); // 抗拉强度很低
  
  return {
    type: MaterialType.ROCK,
    name: `${Math.round(targetFc)}MPa 岩石`,
    fc: actualFc,
    ft,
    E,
    epsilon0,
    epsilonU,
    nu: 0.25,
  };
}

// 砂浆属性生成
function generateMortarProps(targetFc: number, random: () => number, cv: number): MaterialProperties {
  const actualFc = targetFc * (1 + gaussianRandom(random) * cv);
  const E = 3000 * Math.sqrt(actualFc) * (0.85 + random() * 0.3); // 弹性模量较低
  const epsilon0 = 0.0025 + random() * 0.001; // 峰值应变较大
  const epsilonU = 0.004 + random() * 0.001;
  const ft = actualFc * (0.1 + random() * 0.05);
  
  return {
    type: MaterialType.MORTAR,
    name: `M${Math.round(targetFc)} 砂浆`,
    fc: actualFc,
    ft,
    E,
    epsilon0,
    epsilonU,
    nu: 0.18,
  };
}

// 砖块属性生成
function generateBrickProps(targetFc: number, random: () => number, cv: number): MaterialProperties {
  const actualFc = targetFc * (1 + gaussianRandom(random) * cv * 1.2); // 砖块变异较大
  const E = 1000 * actualFc * (0.7 + random() * 0.6); // 弹性模量变化大
  const epsilon0 = 0.002 + random() * 0.001;
  const epsilonU = 0.003 + random() * 0.001;
  const ft = actualFc * (0.08 + random() * 0.04);
  
  return {
    type: MaterialType.BRICK,
    name: `MU${Math.round(targetFc)} 砖`,
    fc: actualFc,
    ft,
    E,
    epsilon0,
    epsilonU,
    nu: 0.15,
  };
}

// ==================== 本构模型计算 ====================

/**
 * 通用应力计算函数
 */
export function calculateStressGeneric(
  strain: number,
  props: MaterialProperties
): StressStrainPoint {
  switch (props.type) {
    case MaterialType.STEEL:
      return calculateSteelStress(strain, props);
    case MaterialType.ROCK:
      return calculateRockStress(strain, props);
    default:
      return calculateConcreteStress(strain, props);
  }
}

// 混凝土/砂浆/砖块本构 - 支持多种本构模型
let lastLoggedModel: string | null = null;
function calculateConcreteStress(strain: number, props: MaterialProperties): StressStrainPoint {
  const { fc, epsilon0, epsilonU, E, constitutiveModel = 'hognestad' } = props;
  
  // 调试：确认使用的本构模型（每次模型变化时输出）
  if (constitutiveModel !== lastLoggedModel) {
    console.log('本构模型计算 - 使用模型:', constitutiveModel, 'fc:', fc, 'ε₀:', epsilon0);
    lastLoggedModel = constitutiveModel;
  }
  
  // 座浆阶段
  if (strain < 0.0001) {
    const seatingRatio = strain / 0.0001;
    const seatingStress = getConstitutiveStress(0.0001, fc, epsilon0, E, constitutiveModel) * seatingRatio * seatingRatio * seatingRatio;
    return { strain, stress: Math.max(0, seatingStress), phase: 'seating' };
  }
  
  // 根据本构模型计算应力
  const stress = getConstitutiveStress(strain, fc, epsilon0, E, constitutiveModel);
  
  // 确定阶段
  let phase: StressStrainPoint['phase'];
  if (strain < epsilon0 * 0.4) phase = 'elastic';
  else if (strain < epsilon0 * 0.9) phase = 'plastic';
  else if (strain <= epsilon0) phase = 'peak';
  else if (strain <= epsilonU * 1.5) phase = 'softening';
  else phase = 'failed';
  
  return { strain, stress: Math.max(0, stress), phase };
}

/**
 * 根据本构模型类型计算应力
 */
function getConstitutiveStress(
  strain: number, 
  fc: number, 
  epsilon0: number, 
  E: number,
  model: ConstitutiveModelType
): number {
  switch (model) {
    case 'hognestad':
      return hognestad(strain, fc, epsilon0);
    case 'gb50010':
      return gb50010Stress(strain, fc, epsilon0);
    case 'damage':
      return damageStress(strain, fc, epsilon0, E).stress;
    case 'mander':
      return manderStress(strain, fc, epsilon0, E);
    case 'eurocode':
      return eurocodeStress(strain, fc, epsilon0, E);
    case 'linear':
      return Math.min(E * strain, fc);
    default:
      return hognestad(strain, fc, epsilon0);
  }
}

/**
 * Mander 约束混凝土本构
 */
function manderStress(strain: number, fc: number, epsilon0: number, E: number): number {
  if (strain <= 0) return 0;
  
  const fcc = fc;
  const epsilonCC = epsilon0;
  
  const Esec = fcc / epsilonCC;
  const r = E / (E - Esec);
  const x = strain / epsilonCC;
  
  const stress = fcc * x * r / (r - 1 + Math.pow(x, r));
  return Math.max(0, stress);
}

/**
 * Eurocode 2 本构
 */
function eurocodeStress(strain: number, fc: number, epsilon0: number, E: number): number {
  if (strain <= 0) return 0;
  
  const k = 1.05 * E * epsilon0 / fc;
  const eta = strain / epsilon0;
  
  if (eta <= 1) {
    const stress = fc * (k * eta - eta * eta) / (1 + (k - 2) * eta);
    return Math.max(0, stress);
  } else {
    // 下降段
    const stress = fc * Math.max(0.2, 1 - 0.3 * (eta - 1));
    return stress;
  }
}

// 钢材本构 (理想弹塑性 + 强化)
function calculateSteelStress(strain: number, props: MaterialProperties): StressStrainPoint {
  const { fc: fy, ft: fu, E, epsilon0: epsilonY, epsilonU } = props;
  
  // 弹性阶段
  if (strain <= epsilonY) {
    const stress = E * strain;
    return { strain, stress, phase: strain < epsilonY * 0.8 ? 'elastic' : 'plastic' };
  }
  
  // 屈服平台 (约 10 倍屈服应变)
  const epsilonSh = epsilonY * 10;
  if (strain <= epsilonSh) {
    return { strain, stress: fy, phase: 'peak' };
  }
  
  // 强化阶段
  if (strain <= epsilonU) {
    const hardeningRatio = (strain - epsilonSh) / (epsilonU - epsilonSh);
    const stress = fy + (fu - fy) * hardeningRatio;
    return { strain, stress, phase: 'softening' };
  }
  
  return { strain, stress: fu * 0.5, phase: 'failed' };
}

// 岩石本构 (脆性破坏)
function calculateRockStress(strain: number, props: MaterialProperties): StressStrainPoint {
  const { fc, E, epsilon0, epsilonU } = props;
  
  // 弹性阶段 (岩石几乎全程弹性)
  if (strain <= epsilon0 * 0.9) {
    const stress = E * strain;
    return { strain, stress: Math.min(stress, fc), phase: 'elastic' };
  }
  
  // 峰值附近
  if (strain <= epsilon0) {
    return { strain, stress: fc, phase: 'peak' };
  }
  
  // 脆性破坏 (快速下降)
  if (strain <= epsilonU) {
    const dropRatio = (strain - epsilon0) / (epsilonU - epsilon0);
    const stress = fc * (1 - dropRatio * 0.8);
    return { strain, stress: Math.max(stress, fc * 0.1), phase: 'softening' };
  }
  
  return { strain, stress: fc * 0.05, phase: 'failed' };
}

// Hognestad 抛物线
function hognestad(strain: number, fc: number, epsilon0: number): number {
  const ratio = strain / epsilon0;
  return fc * (2 * ratio - ratio * ratio);
}

/**
 * GB 50010-2010 中国规范混凝土本构模型
 * 
 * 上升段: σ = fc × [αa·n + (3-2αa)n² + (αa-2)n³], n = ε/εc
 * 下降段: σ = fc / [αd·(n-1)² + n]
 * 
 * 参数计算 (根据 GB 50010-2010 附录 C):
 * - εc = (700 + 172√fc) × 10⁻⁶  峰值应变
 * - αa = 2.4 - 0.0125·fcu,k     上升段参数 (fcu,k 为立方体强度特征值)
 * - αd = 0.157·fcu,k^0.785 - 0.905  下降段参数
 * 
 * 注：fcu,k ≈ fc / 0.76 (棱柱体强度转换为立方体强度)
 */
export function gb50010Stress(strain: number, fc: number, epsilon0: number): number {
  if (strain <= 0) return 0;
  
  // 将棱柱体强度转换为立方体强度特征值
  const fcu_k = fc / 0.76;
  
  // 计算参数 (GB 50010-2010 附录 C)
  // αa 控制上升段曲线形状，值越小初始斜率越大
  const alphaA = Math.max(1.0, Math.min(2.4, 2.4 - 0.0125 * fcu_k));
  // αd 控制下降段曲线形状，值越大下降越缓
  const alphaD = Math.max(0.5, 0.157 * Math.pow(fcu_k, 0.785) - 0.905);
  
  const n = strain / epsilon0;
  
  // 调试输出
  if (Math.random() < 0.001) {
    console.log('GB50010 参数: fcu_k=', fcu_k.toFixed(1), 'αa=', alphaA.toFixed(3), 'αd=', alphaD.toFixed(3), 'n=', n.toFixed(3));
  }
  
  if (n <= 1) {
    // 上升段: σ = fc × [αa·n + (3-2αa)n² + (αa-2)n³]
    const stress = fc * (alphaA * n + (3 - 2 * alphaA) * n * n + (alphaA - 2) * n * n * n);
    return Math.max(0, stress);
  } else {
    // 下降段: σ = fc / [αd·(n-1)² + n]
    const stress = fc / (alphaD * (n - 1) * (n - 1) + n);
    return Math.max(0, stress);
  }
}

/**
 * 损伤本构模型
 * σ = (1 - d) × E × ε
 * 
 * 损伤变量 d 的演化:
 * - 上升段: d = 1 - (σ_env / (E × ε)), 其中 σ_env 是包络线应力
 * - 下降段: d 继续增加，表示刚度退化
 */
export function damageStress(
  strain: number, 
  fc: number, 
  epsilon0: number, 
  E: number
): { stress: number; damage: number } {
  if (strain <= 0) return { stress: 0, damage: 0 };
  
  // 使用 Hognestad 作为包络线
  const envelopeStress = hognestad(Math.min(strain, epsilon0), fc, epsilon0);
  
  // 计算损伤变量
  const elasticStress = E * strain;
  let damage = 0;
  let stress = 0;
  
  if (strain <= epsilon0) {
    // 上升段：损伤逐渐累积
    if (elasticStress > 0) {
      damage = 1 - envelopeStress / elasticStress;
      damage = Math.max(0, Math.min(0.99, damage));
    }
    stress = envelopeStress;
  } else {
    // 下降段：损伤继续增加
    const postPeakRatio = (strain - epsilon0) / epsilon0;
    damage = 1 - fc / elasticStress * Math.exp(-0.5 * postPeakRatio);
    damage = Math.max(0, Math.min(0.99, damage));
    stress = (1 - damage) * E * strain;
  }
  
  return { stress: Math.max(0, stress), damage };
}


// ==================== 向后兼容函数 ====================

/**
 * 保持向后兼容的混凝土属性生成函数
 */
export function generateConcreteProperties(targetFcu: number, randomSeed?: number): ConcreteProperties {
  const props = generateMaterialProperties(MaterialType.CONCRETE, targetFcu, randomSeed);
  return {
    ...props,
    fcu: props.fc,
    Ec: props.E,
  };
}

/**
 * 保持向后兼容的应力计算函数
 */
export function calculateStress(strain: number, props: ConcreteProperties | MaterialProperties): StressStrainPoint {
  return calculateStressGeneric(strain, props as MaterialProperties);
}

// ==================== 辅助函数 ====================

/**
 * 添加微小噪声 - 用于演示，保持曲线平滑美观
 */
export function addRealisticNoise(
  stress: number,
  strain: number,
  _phase: StressStrainPoint['phase']
): { stress: number; strain: number } {
  // 非常小的噪声，仅用于让曲线看起来更自然，不会产生明显毛刺
  const tinyNoise = stress * 0.001 * (Math.random() - 0.5);
  
  return {
    stress: Math.max(0, stress + tinyNoise),
    strain: strain // 应变不加噪声，保持平滑
  };
}

/**
 * 破坏预警
 */
export function getFailureWarning(
  currentStrain: number,
  props: ConcreteProperties | MaterialProperties
): { level: 'none' | 'low' | 'medium' | 'high' | 'imminent'; message: string } {
  const epsilon0 = props.epsilon0 || 0.002;
  const ratio = currentStrain / epsilon0;
  
  if (ratio < 0.6) return { level: 'none', message: '' };
  if (ratio < 0.8) return { level: 'low', message: '微裂缝发展 Micro-cracks' };
  if (ratio < 0.95) return { level: 'medium', message: '表面裂缝 Surface cracks' };
  if (ratio < 1.0) return { level: 'high', message: '接近峰值 Near peak' };
  return { level: 'imminent', message: '峰后软化 Post-peak' };
}

/**
 * 生成裂缝路径
 */
export function generateCrackPaths(
  failureProgress: number,
  testType: 'compression' | 'tension',
  seed: number
): string[] {
  const random = seededRandom(seed);
  const paths: string[] = [];
  
  if (failureProgress < 0.7) return paths;
  
  const intensity = (failureProgress - 0.7) / 0.3;
  const numCracks = Math.floor(intensity * 8) + 1;
  
  if (testType === 'compression') {
    for (let i = 0; i < numCracks; i++) {
      const startX = 20 + random() * 60;
      const midX = startX + (random() - 0.5) * 30;
      const endX = startX + (random() - 0.5) * 20;
      if (random() > 0.5) {
        paths.push(`M ${startX} 0 Q ${midX} 50, ${endX} ${40 + random() * 60}`);
      } else {
        paths.push(`M ${startX} 100 Q ${midX} 50, ${endX} ${60 - random() * 60}`);
      }
    }
  } else {
    const centerX = 50 + (random() - 0.5) * 10;
    const wobble1 = (random() - 0.5) * 8;
    const wobble2 = (random() - 0.5) * 8;
    paths.push(`M ${centerX} 0 Q ${centerX + wobble1} 33, ${centerX + wobble2} 66 T ${centerX} 100`);
  }
  
  return paths;
}

/**
 * 劈裂抗拉应力计算
 */
export function calculateSplittingStress(load: number, length: number, diameter: number): number {
  return (2 * load * 1000) / (Math.PI * length * diameter);
}

// 工具函数
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function gaussianRandom(random: () => number = Math.random): number {
  let u = 0, v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ==================== 材料信息 ====================

export const MATERIAL_INFO: Record<MaterialType, { name: string; defaultStrength: number; unit: string; strengthRange: [number, number]; description?: string }> = {
  [MaterialType.CONCRETE]: { name: '普通混凝土', defaultStrength: 30, unit: 'MPa', strengthRange: [15, 80], description: '常规配合比混凝土' },
  [MaterialType.HPC]: { name: '高性能混凝土', defaultStrength: 60, unit: 'MPa', strengthRange: [50, 120], description: '高强度、高耐久性' },
  [MaterialType.FRC]: { name: '纤维混凝土', defaultStrength: 40, unit: 'MPa', strengthRange: [20, 80], description: '钢纤维/聚丙烯纤维增强' },
  [MaterialType.LAC]: { name: '轻骨料混凝土', defaultStrength: 25, unit: 'MPa', strengthRange: [10, 50], description: '陶粒/页岩陶粒骨料' },
  [MaterialType.SCC]: { name: '自密实混凝土', defaultStrength: 40, unit: 'MPa', strengthRange: [25, 80], description: '高流动性、免振捣' },
  [MaterialType.STEEL]: { name: '钢材', defaultStrength: 235, unit: 'MPa', strengthRange: [195, 460], description: '结构钢材' },
  [MaterialType.ROCK]: { name: '岩石', defaultStrength: 50, unit: 'MPa', strengthRange: [10, 200], description: '天然岩石试样' },
  [MaterialType.MORTAR]: { name: '砂浆', defaultStrength: 10, unit: 'MPa', strengthRange: [2.5, 25], description: '水泥砂浆' },
  [MaterialType.BRICK]: { name: '砖块', defaultStrength: 10, unit: 'MPa', strengthRange: [5, 30], description: '烧结砖/蒸压砖' },
};
