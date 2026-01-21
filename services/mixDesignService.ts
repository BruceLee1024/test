/**
 * 混凝土配合比计算服务
 * 根据配合比参数计算混凝土抗压强度
 */

// 混凝土配合比参数
export interface ConcreteMixDesign {
  // 基本材料用量 (kg/m³)
  cement: number;           // 水泥用量
  water: number;            // 用水量
  fineAggregate: number;    // 细骨料（砂）用量
  coarseAggregate: number;  // 粗骨料（石子）用量
  admixture?: number;       // 外加剂用量（可选）
  
  // 材料特性
  cementStrength: number;   // 水泥强度等级 (MPa) 如 42.5, 52.5
  waterCementRatio?: number; // 水灰比（自动计算或手动输入）
  sandRatio?: number;        // 砂率 (%)（自动计算或手动输入）
  
  // 骨料特性
  maxAggregateSize: number; // 最大骨料粒径 (mm)
  aggregateType: 'crushed' | 'natural'; // 骨料类型：碎石/卵石
  
  // 养护条件
  curingDays: number;       // 养护龄期 (天)
  curingCondition: 'standard' | 'natural'; // 养护条件
}

// 预设配合比模板
export interface MixDesignTemplate {
  name: string;
  description: string;
  targetStrength: number;   // 目标强度 (MPa)
  mixDesign: ConcreteMixDesign;
}

// 常用配合比模板
export const MIX_DESIGN_TEMPLATES: MixDesignTemplate[] = [
  {
    name: 'C20 普通混凝土',
    description: '适用于一般结构，水灰比0.60',
    targetStrength: 20,
    mixDesign: {
      cement: 330,
      water: 198,
      fineAggregate: 682,
      coarseAggregate: 1150,
      cementStrength: 42.5,
      waterCementRatio: 0.60,
      sandRatio: 37.2,
      maxAggregateSize: 31.5,
      aggregateType: 'crushed',
      curingDays: 28,
      curingCondition: 'standard',
    },
  },
  {
    name: 'C30 普通混凝土',
    description: '适用于一般承重结构，水灰比0.50',
    targetStrength: 30,
    mixDesign: {
      cement: 380,
      water: 190,
      fineAggregate: 650,
      coarseAggregate: 1140,
      cementStrength: 42.5,
      waterCementRatio: 0.50,
      sandRatio: 36.3,
      maxAggregateSize: 31.5,
      aggregateType: 'crushed',
      curingDays: 28,
      curingCondition: 'standard',
    },
  },
  {
    name: 'C40 高强混凝土',
    description: '适用于重要结构，水灰比0.40',
    targetStrength: 40,
    mixDesign: {
      cement: 450,
      water: 180,
      fineAggregate: 620,
      coarseAggregate: 1120,
      cementStrength: 52.5,
      waterCementRatio: 0.40,
      sandRatio: 35.6,
      maxAggregateSize: 25,
      aggregateType: 'crushed',
      curingDays: 28,
      curingCondition: 'standard',
    },
  },
  {
    name: 'C50 高强混凝土',
    description: '适用于高层建筑、桥梁等，水灰比0.35',
    targetStrength: 50,
    mixDesign: {
      cement: 500,
      water: 175,
      fineAggregate: 600,
      coarseAggregate: 1100,
      admixture: 10,
      cementStrength: 52.5,
      waterCementRatio: 0.35,
      sandRatio: 35.3,
      maxAggregateSize: 25,
      aggregateType: 'crushed',
      curingDays: 28,
      curingCondition: 'standard',
    },
  },
  {
    name: 'C60 超高强混凝土',
    description: '适用于超高层、大跨度结构，水灰比0.30',
    targetStrength: 60,
    mixDesign: {
      cement: 550,
      water: 165,
      fineAggregate: 580,
      coarseAggregate: 1080,
      admixture: 15,
      cementStrength: 52.5,
      waterCementRatio: 0.30,
      sandRatio: 34.9,
      maxAggregateSize: 20,
      aggregateType: 'crushed',
      curingDays: 28,
      curingCondition: 'standard',
    },
  },
];

/**
 * 计算水灰比
 */
export function calculateWaterCementRatio(water: number, cement: number): number {
  return water / cement;
}

/**
 * 计算砂率
 */
export function calculateSandRatio(fineAggregate: number, coarseAggregate: number): number {
  const totalAggregate = fineAggregate + coarseAggregate;
  return (fineAggregate / totalAggregate) * 100;
}

/**
 * 根据配合比计算混凝土抗压强度
 * 使用 Bolomey 公式和经验修正
 */
export function calculateConcreteStrength(mixDesign: ConcreteMixDesign): number {
  const {
    cement,
    water,
    cementStrength,
    waterCementRatio,
    maxAggregateSize,
    aggregateType,
    curingDays,
    curingCondition,
    admixture = 0,
  } = mixDesign;

  // 计算实际水灰比
  const actualWCRatio = waterCementRatio || calculateWaterCementRatio(water, cement);

  // Bolomey 公式基础强度计算
  // fcu = A * fce * (C/W - B)
  // 其中：
  // fcu = 混凝土立方体抗压强度
  // fce = 水泥实际强度 (通常取水泥强度等级的 1.0-1.13 倍)
  // C/W = 水泥用量/用水量（水灰比的倒数）
  // A, B = 经验系数

  const fce = cementStrength * 1.05; // 水泥实际强度
  const cementWaterRatio = 1 / actualWCRatio; // 灰水比

  // 经验系数（根据骨料类型调整）
  let A = aggregateType === 'crushed' ? 0.46 : 0.43; // 碎石系数更高
  let B = aggregateType === 'crushed' ? 0.07 : 0.10;

  // 基础强度计算
  let baseStrength = A * fce * (cementWaterRatio - B);

  // 骨料粒径修正（较大粒径略微降低强度）
  const aggregateSizeFactor = maxAggregateSize <= 20 ? 1.0 : 
                              maxAggregateSize <= 31.5 ? 0.98 : 0.96;
  baseStrength *= aggregateSizeFactor;

  // 外加剂修正（减水剂等可提高强度）
  if (admixture > 0) {
    const admixtureFactor = 1 + (admixture / cement) * 0.15; // 外加剂掺量对强度的提升
    baseStrength *= Math.min(admixtureFactor, 1.20); // 最多提升20%
  }

  // 龄期修正（根据 GB 50010-2010）
  let ageFactor = 1.0;
  if (curingDays < 28) {
    // 龄期小于28天的强度折减
    if (curingDays === 7) {
      ageFactor = 0.65;
    } else if (curingDays === 14) {
      ageFactor = 0.85;
    } else {
      // 线性插值
      ageFactor = 0.65 + (curingDays - 7) * (1.0 - 0.65) / (28 - 7);
    }
  } else if (curingDays > 28) {
    // 龄期大于28天的强度增长（对数增长，逐渐趋于稳定）
    ageFactor = 1.0 + Math.log10(curingDays / 28) * 0.15;
    ageFactor = Math.min(ageFactor, 1.25); // 最多增长25%
  }
  baseStrength *= ageFactor;

  // 养护条件修正
  const curingFactor = curingCondition === 'standard' ? 1.0 : 0.85; // 自然养护约降低15%
  baseStrength *= curingFactor;

  // 确保强度在合理范围内
  return Math.max(10, Math.min(baseStrength, 100));
}

/**
 * 根据目标强度推荐配合比
 * 使用反算法估算所需水泥用量
 */
export function recommendMixDesign(
  targetStrength: number,
  cementStrength: number = 42.5,
  aggregateType: 'crushed' | 'natural' = 'crushed'
): ConcreteMixDesign {
  // 根据目标强度确定水灰比（经验公式）
  // 对于普通混凝土：W/C ≈ 0.46*fce / (fcu + 0.07*0.46*fce)
  const fce = cementStrength * 1.05;
  const A = aggregateType === 'crushed' ? 0.46 : 0.43;
  const B = aggregateType === 'crushed' ? 0.07 : 0.10;
  
  // 反算水灰比
  let waterCementRatio = A * fce / (targetStrength + B * A * fce);
  
  // 限制水灰比范围
  waterCementRatio = Math.max(0.28, Math.min(waterCementRatio, 0.70));
  
  // 根据水灰比确定用水量（经验值 165-205 kg/m³）
  let water = 185; // 中等用水量
  if (waterCementRatio < 0.35) {
    water = 170; // 低水灰比，使用减水剂
  } else if (waterCementRatio > 0.55) {
    water = 195; // 高水灰比
  }
  
  // 计算水泥用量
  const cement = Math.round(water / waterCementRatio);
  
  // 计算骨料用量（体积法）
  // 假设混凝土密度 2400 kg/m³，砂率根据强度调整
  let sandRatio = 35; // 默认砂率
  if (targetStrength >= 50) {
    sandRatio = 34;
  } else if (targetStrength >= 40) {
    sandRatio = 35;
  } else if (targetStrength >= 30) {
    sandRatio = 36;
  } else {
    sandRatio = 37;
  }
  
  const totalAggregate = 2400 - cement - water;
  const fineAggregate = Math.round(totalAggregate * sandRatio / 100);
  const coarseAggregate = Math.round(totalAggregate - fineAggregate);
  
  // 确定最大骨料粒径
  const maxAggregateSize = targetStrength >= 50 ? 20 : targetStrength >= 30 ? 25 : 31.5;
  
  // 确定是否需要外加剂
  const admixture = waterCementRatio < 0.40 ? Math.round(cement * 0.02) : 0;
  
  return {
    cement,
    water,
    fineAggregate,
    coarseAggregate,
    admixture,
    cementStrength,
    waterCementRatio,
    sandRatio,
    maxAggregateSize,
    aggregateType,
    curingDays: 28,
    curingCondition: 'standard',
  };
}

/**
 * 验证配合比是否合理
 */
export function validateMixDesign(mixDesign: ConcreteMixDesign): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const { cement, water, fineAggregate, coarseAggregate, cementStrength, waterCementRatio } = mixDesign;
  
  // 计算实际水灰比
  const actualWCRatio = waterCementRatio || calculateWaterCementRatio(water, cement);
  
  // 检查水灰比
  if (actualWCRatio < 0.25) {
    errors.push('水灰比过低（< 0.25），混凝土难以施工');
  } else if (actualWCRatio < 0.30) {
    warnings.push('水灰比较低，建议使用高效减水剂');
  }
  
  if (actualWCRatio > 0.70) {
    errors.push('水灰比过高（> 0.70），强度和耐久性不足');
  } else if (actualWCRatio > 0.60) {
    warnings.push('水灰比较高，强度可能偏低');
  }
  
  // 检查水泥用量
  if (cement < 250) {
    errors.push('水泥用量过低（< 250 kg/m³），不满足最小用量要求');
  } else if (cement < 300) {
    warnings.push('水泥用量较低，注意检查强度');
  }
  
  if (cement > 600) {
    warnings.push('水泥用量过高（> 600 kg/m³），可能导致收缩开裂');
  }
  
  // 检查用水量
  if (water < 150) {
    warnings.push('用水量较低，注意和易性');
  }
  
  if (water > 220) {
    warnings.push('用水量过高（> 220 kg/m³），影响强度和耐久性');
  }
  
  // 检查砂率
  const actualSandRatio = calculateSandRatio(fineAggregate, coarseAggregate);
  if (actualSandRatio < 25) {
    warnings.push('砂率过低（< 25%），混凝土可能离析');
  } else if (actualSandRatio > 45) {
    warnings.push('砂率过高（> 45%），水泥用量可能不足');
  }
  
  // 检查总质量
  const totalMass = cement + water + fineAggregate + coarseAggregate + (mixDesign.admixture || 0);
  if (totalMass < 2200 || totalMass > 2600) {
    warnings.push(`混凝土总质量 ${totalMass.toFixed(0)} kg/m³ 超出常规范围 (2200-2600)`);
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * 格式化配合比显示
 */
export function formatMixDesign(mixDesign: ConcreteMixDesign): string {
  const wcRatio = (mixDesign.waterCementRatio || calculateWaterCementRatio(mixDesign.water, mixDesign.cement)).toFixed(2);
  const sandRatio = (mixDesign.sandRatio || calculateSandRatio(mixDesign.fineAggregate, mixDesign.coarseAggregate)).toFixed(1);
  
  return `水泥:${mixDesign.cement} | 水:${mixDesign.water} | 砂:${mixDesign.fineAggregate} | 石:${mixDesign.coarseAggregate}${
    mixDesign.admixture ? ` | 外加剂:${mixDesign.admixture}` : ''
  } (kg/m³)\n水灰比: ${wcRatio} | 砂率: ${sandRatio}%`;
}
