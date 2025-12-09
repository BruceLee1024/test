import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { MaterialType } from '../types';
import { MATERIAL_INFO } from '../services/concreteModel';
import { FormulaBlock, InlineFormula } from './MathFormula';

// 本构模型类型
type ModelType = 
  | 'hognestad' 
  | 'eurocode' 
  | 'chinese_parabola'
  | 'chinese_damage'
  | 'mander' 
  | 'kent_park'
  | 'popovics'
  | 'carreira_chu'
  | 'thorenfeldt'
  | 'ceb_fip'
  | 'steel' 
  | 'rock';

interface SymbolDef {
  symbol: string;
  meaning: string;
  unit?: string;
}

interface ModelInfo {
  name: string;
  nameEn: string;
  description: string;
  formula: string;
  symbols: SymbolDef[];
  applicable: MaterialType[];
  category: 'concrete' | 'steel' | 'rock' | 'other';
  year?: number;
  reference?: string;
}

const MODELS: Record<ModelType, ModelInfo> = {
  // ========== 混凝土模型 ==========
  hognestad: {
    name: 'Hognestad 模型',
    nameEn: 'Hognestad Model',
    description: '经典抛物线-线性下降模型，适用于普通混凝土，简单实用',
    formula: String.raw`\sigma = f_c \left[ 2\frac{\varepsilon}{\varepsilon_0} - \left(\frac{\varepsilon}{\varepsilon_0}\right)^2 \right]`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变（约0.002）', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE, MaterialType.MORTAR],
    category: 'concrete',
    year: 1951,
    reference: 'Hognestad E. (1951)',
  },
  eurocode: {
    name: '欧洲规范 EC2',
    nameEn: 'Eurocode 2 Model',
    description: '欧洲规范 EN 1992-1-1 推荐的混凝土本构模型',
    formula: String.raw`\sigma = f_c \cdot \frac{k\eta - \eta^2}{1 + (k-2)\eta}, \quad \eta = \frac{\varepsilon}{\varepsilon_{c1}}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: 'k', meaning: '塑性系数 k=1.05Ecε₀/fc', unit: '-' },
      { symbol: '\\eta', meaning: '归一化应变 ε/εc1', unit: '-' },
      { symbol: '\\varepsilon_{c1}', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 2004,
    reference: 'EN 1992-1-1:2004',
  },
  chinese_parabola: {
    name: '中国规范(抛物线)',
    nameEn: 'Chinese Code (Parabola)',
    description: 'GB 50010-2010 混凝土结构设计规范，上升段抛物线模型',
    formula: String.raw`\sigma = f_c \left[ \alpha_a x + (3-2\alpha_a)x^2 + (\alpha_a - 2)x^3 \right], \quad x = \frac{\varepsilon}{\varepsilon_0}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土轴心抗压强度', unit: 'MPa' },
      { symbol: '\\alpha_a', meaning: '上升段参数 αa=2.4-0.0125fc', unit: '-' },
      { symbol: 'x', meaning: '归一化应变 ε/ε₀', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 2010,
    reference: 'GB 50010-2010',
  },
  chinese_damage: {
    name: '中国规范(损伤)',
    nameEn: 'Chinese Code (Damage)',
    description: 'GB 50010-2010 附录C，基于损伤的本构模型',
    formula: String.raw`\sigma = (1-d_c) E_c \varepsilon, \quad d_c = 1 - \frac{\rho_c}{\alpha_a + (3-2\alpha_a)x^2 + (\alpha_a-2)x^3}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'd_c', meaning: '受压损伤因子', unit: '-' },
      { symbol: 'E_c', meaning: '混凝土弹性模量', unit: 'MPa' },
      { symbol: '\\rho_c', meaning: '强度比 fc/(Ecε₀)', unit: '-' },
      { symbol: '\\alpha_a', meaning: '上升段参数', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 2010,
    reference: 'GB 50010-2010 附录C',
  },
  mander: {
    name: 'Mander 约束模型',
    nameEn: 'Mander Confined Model',
    description: '考虑箍筋约束效应的混凝土模型，适用于柱构件',
    formula: String.raw`\sigma = \frac{f'_{cc} \cdot x \cdot r}{r - 1 + x^r}, \quad x = \frac{\varepsilon}{\varepsilon_{cc}}, \quad r = \frac{E_c}{E_c - E_{sec}}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: "f'_{cc}", meaning: '约束混凝土强度', unit: 'MPa' },
      { symbol: 'x', meaning: '归一化应变 ε/εcc', unit: '-' },
      { symbol: 'r', meaning: '曲线形状参数', unit: '-' },
      { symbol: '\\varepsilon_{cc}', meaning: '约束混凝土峰值应变', unit: '-' },
      { symbol: 'E_{sec}', meaning: '割线模量 fcc/εcc', unit: 'MPa' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1988,
    reference: 'Mander et al. (1988)',
  },
  kent_park: {
    name: 'Kent-Park 模型',
    nameEn: 'Kent-Park Model',
    description: '考虑约束效应的三段式模型，广泛用于抗震分析',
    formula: String.raw`\sigma = \begin{cases} f_c \left[ 2\frac{\varepsilon}{\varepsilon_0} - \left(\frac{\varepsilon}{\varepsilon_0}\right)^2 \right] & \varepsilon \leq \varepsilon_0 \\ f_c \left[ 1 - Z(\varepsilon - \varepsilon_0) \right] & \varepsilon > \varepsilon_0 \end{cases}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
      { symbol: 'Z', meaning: '下降段斜率参数', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1971,
    reference: 'Kent & Park (1971)',
  },
  popovics: {
    name: 'Popovics 模型',
    nameEn: 'Popovics Model',
    description: '基于强度的统一本构模型，适用于不同强度等级',
    formula: String.raw`\sigma = f_c \cdot \frac{n \cdot \left(\frac{\varepsilon}{\varepsilon_0}\right)}{n - 1 + \left(\frac{\varepsilon}{\varepsilon_0}\right)^n}, \quad n = 0.8 + \frac{f_c}{17}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: 'n', meaning: '曲线形状参数', unit: '-' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1973,
    reference: 'Popovics S. (1973)',
  },
  carreira_chu: {
    name: 'Carreira-Chu 模型',
    nameEn: 'Carreira-Chu Model',
    description: '改进的 Popovics 模型，更好地描述高强混凝土',
    formula: String.raw`\sigma = f_c \cdot \frac{\beta \cdot \left(\frac{\varepsilon}{\varepsilon_0}\right)}{\beta - 1 + \left(\frac{\varepsilon}{\varepsilon_0}\right)^\beta}, \quad \beta = \frac{1}{1 - \frac{f_c}{\varepsilon_0 E_c}}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: '\\beta', meaning: '材料参数', unit: '-' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
      { symbol: 'E_c', meaning: '弹性模量', unit: 'MPa' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1985,
    reference: 'Carreira & Chu (1985)',
  },
  thorenfeldt: {
    name: 'Thorenfeldt 模型',
    nameEn: 'Thorenfeldt Model',
    description: '适用于高强混凝土的本构模型，峰后下降更陡',
    formula: String.raw`\sigma = f_c \cdot \frac{n \cdot \left(\frac{\varepsilon}{\varepsilon_0}\right)}{n - 1 + \left(\frac{\varepsilon}{\varepsilon_0}\right)^{nk}}, \quad k = \begin{cases} 1 & \varepsilon \leq \varepsilon_0 \\ 0.67 + \frac{f_c}{62} & \varepsilon > \varepsilon_0 \end{cases}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: 'n', meaning: '曲线形状参数 n=0.8+fc/17', unit: '-' },
      { symbol: 'k', meaning: '下降段修正系数', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1987,
    reference: 'Thorenfeldt et al. (1987)',
  },
  ceb_fip: {
    name: 'CEB-FIP 模型',
    nameEn: 'CEB-FIP Model Code',
    description: '国际混凝土联合会推荐模型，考虑时间效应',
    formula: String.raw`\sigma = f_c \cdot \frac{k\eta - \eta^2}{1 + (k-2)\eta}, \quad k = \frac{E_{ci}}{E_{c1}}, \quad \eta = \frac{\varepsilon}{\varepsilon_{c1}}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'f_c', meaning: '混凝土抗压强度', unit: 'MPa' },
      { symbol: 'k', meaning: '塑性系数', unit: '-' },
      { symbol: '\\eta', meaning: '归一化应变', unit: '-' },
      { symbol: 'E_{ci}', meaning: '初始切线模量', unit: 'MPa' },
      { symbol: 'E_{c1}', meaning: '峰值割线模量 fc/εc1', unit: 'MPa' },
      { symbol: '\\varepsilon_{c1}', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.CONCRETE],
    category: 'concrete',
    year: 1990,
    reference: 'CEB-FIP Model Code 1990',
  },
  // ========== 其他材料 ==========
  steel: {
    name: '理想弹塑性模型',
    nameEn: 'Elastic-Plastic Model',
    description: '钢材的理想弹塑性本构关系',
    formula: String.raw`\sigma = \begin{cases} E\varepsilon & \varepsilon \leq \varepsilon_y \\ f_y & \varepsilon > \varepsilon_y \end{cases}`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'E', meaning: '弹性模量', unit: 'MPa' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: '\\varepsilon_y', meaning: '屈服应变', unit: '-' },
      { symbol: 'f_y', meaning: '屈服强度', unit: 'MPa' },
    ],
    applicable: [MaterialType.STEEL],
    category: 'steel',
  },
  rock: {
    name: '脆性破坏模型',
    nameEn: 'Brittle Failure Model',
    description: '岩石的脆性破坏本构模型',
    formula: String.raw`\sigma = E\varepsilon \quad (\text{线性段}), \quad \sigma = f_c \cdot e^{-\alpha(\varepsilon - \varepsilon_0)} \quad (\text{峰后})`,
    symbols: [
      { symbol: '\\sigma', meaning: '应力', unit: 'MPa' },
      { symbol: 'E', meaning: '弹性模量', unit: 'MPa' },
      { symbol: '\\varepsilon', meaning: '应变', unit: '-' },
      { symbol: 'f_c', meaning: '抗压强度', unit: 'MPa' },
      { symbol: '\\alpha', meaning: '脆性衰减系数', unit: '-' },
      { symbol: '\\varepsilon_0', meaning: '峰值应变', unit: '-' },
    ],
    applicable: [MaterialType.ROCK],
    category: 'rock',
  },
};

// 生成本构曲线数据
function generateCurveData(model: ModelType, fc: number, E: number, confinementRatio: number = 1.0): { strain: number; stress: number }[] {
  const data: { strain: number; stress: number }[] = [];
  
  // 基本参数
  const epsilon0 = model === 'steel' ? fc / E : 0.002 + (fc - 30) * 0.00001; // 峰值应变随强度变化
  const epsilonU = model === 'steel' ? 0.02 : model === 'rock' ? 0.003 : 0.0033 + (fc / 100) * 0.001;
  const maxStrain = epsilonU * 2;
  
  for (let i = 0; i <= 150; i++) {
    const strain = (i / 150) * maxStrain;
    let stress = 0;
    
    switch (model) {
      // ========== Hognestad 模型 (1951) ==========
      case 'hognestad': {
        if (strain <= epsilon0) {
          const ratio = strain / epsilon0;
          stress = fc * (2 * ratio - ratio * ratio);
        } else {
          // 线性下降段
          const slope = 0.15 * fc / (epsilonU - epsilon0);
          stress = fc - slope * (strain - epsilon0);
          stress = Math.max(stress, fc * 0.2);
        }
        break;
      }
      
      // ========== Eurocode 2 模型 (2004) ==========
      case 'eurocode': {
        const n = Math.min(2.0, 1.4 + 23.4 * Math.pow((90 - fc) / 100, 4));
        const k = 1.05 * E * epsilon0 / fc;
        const eta = strain / epsilon0;
        
        if (strain <= epsilonU) {
          stress = fc * (k * eta - eta * eta) / (1 + (k - 2) * eta);
          stress = Math.max(0, stress);
        } else {
          stress = fc * 0.2;
        }
        break;
      }
      
      // ========== 中国规范抛物线模型 (GB 50010-2010) ==========
      case 'chinese_parabola': {
        const alphaA = 2.4 - 0.0125 * fc; // 上升段参数
        const x = strain / epsilon0;
        
        if (strain <= epsilon0) {
          stress = fc * (alphaA * x + (3 - 2 * alphaA) * x * x + (alphaA - 2) * x * x * x);
        } else {
          // 下降段
          const alphaD = 0.157 * Math.pow(fc, 0.785) - 0.905;
          stress = fc / (alphaD * (x - 1) * (x - 1) + x);
          stress = Math.max(stress, fc * 0.2);
        }
        break;
      }
      
      // ========== 中国规范损伤模型 (GB 50010-2010 附录C) ==========
      case 'chinese_damage': {
        const rhoC = fc / (E * epsilon0);
        const alphaA = 2.4 - 0.0125 * fc;
        const x = strain / epsilon0;
        
        if (strain <= epsilon0) {
          const dc = 1 - rhoC * (alphaA + (3 - 2 * alphaA) * x + (alphaA - 2) * x * x);
          stress = (1 - dc) * E * strain;
        } else {
          const alphaD = 0.157 * Math.pow(fc, 0.785) - 0.905;
          const dc = 1 - rhoC / (alphaD * (x - 1) * (x - 1) + x);
          stress = (1 - dc) * E * strain;
          stress = Math.max(stress, fc * 0.15);
        }
        break;
      }
      
      // ========== Mander 约束混凝土模型 (1988) ==========
      case 'mander': {
        const fcc = fc * confinementRatio; // 约束混凝土强度
        const epsilonCC = epsilon0 * (1 + 5 * (fcc / fc - 1)); // 约束混凝土峰值应变
        const Esec = fcc / epsilonCC;
        const r = E / (E - Esec);
        const x = strain / epsilonCC;
        
        stress = fcc * x * r / (r - 1 + Math.pow(x, r));
        stress = Math.max(0, stress);
        break;
      }
      
      // ========== Kent-Park 模型 (1971) ==========
      case 'kent_park': {
        const K = confinementRatio; // 约束系数
        const fcc = fc * K;
        const epsilon0K = epsilon0 * K;
        
        if (strain <= epsilon0K) {
          // 上升段：抛物线
          const x = strain / epsilon0K;
          stress = fcc * (2 * x - x * x);
        } else {
          // 下降段：线性
          const Z = 0.5 / (3 + 0.29 * fc / (145 * fc - 1000) + 0.75 * Math.sqrt(150 / 1) - epsilon0K);
          stress = fcc * (1 - Z * (strain - epsilon0K));
          stress = Math.max(stress, fcc * 0.2);
        }
        break;
      }
      
      // ========== Popovics 模型 (1973) ==========
      case 'popovics': {
        const n = 0.8 + fc / 17; // 曲线形状参数
        const x = strain / epsilon0;
        
        stress = fc * n * x / (n - 1 + Math.pow(x, n));
        break;
      }
      
      // ========== Carreira-Chu 模型 (1985) ==========
      case 'carreira_chu': {
        const beta = 1 / (1 - fc / (epsilon0 * E)); // 形状参数
        const x = strain / epsilon0;
        
        stress = fc * beta * x / (beta - 1 + Math.pow(x, beta));
        break;
      }
      
      // ========== Thorenfeldt 模型 (1987) ==========
      case 'thorenfeldt': {
        const n = 0.8 + fc / 17;
        const k = strain <= epsilon0 ? 1 : 0.67 + fc / 62; // 下降段修正系数
        const x = strain / epsilon0;
        
        stress = fc * n * x / (n - 1 + Math.pow(x, n * k));
        break;
      }
      
      // ========== CEB-FIP 模型 (1990) ==========
      case 'ceb_fip': {
        const Eci = E;
        const Ec1 = fc / epsilon0;
        const k = Eci / Ec1;
        const eta = strain / epsilon0;
        
        if (strain <= epsilonU) {
          stress = fc * (k * eta - eta * eta) / (1 + (k - 2) * eta);
          stress = Math.max(0, stress);
        } else {
          stress = fc * 0.2;
        }
        break;
      }
      
      // ========== 钢材模型 ==========
      case 'steel': {
        const fy = fc;
        const epsilonY = fy / E;
        const epsilonSh = epsilonY * 10; // 强化起始应变
        
        if (strain <= epsilonY) {
          stress = E * strain;
        } else if (strain <= epsilonSh) {
          stress = fy; // 屈服平台
        } else if (strain <= epsilonU) {
          // 强化段
          const fu = fy * 1.25;
          stress = fy + (fu - fy) * (strain - epsilonSh) / (epsilonU - epsilonSh);
        } else {
          stress = fy * 1.25;
        }
        break;
      }
      
      // ========== 岩石模型 ==========
      case 'rock': {
        if (strain <= epsilon0 * 0.95) {
          stress = E * strain;
          stress = Math.min(stress, fc);
        } else if (strain <= epsilon0) {
          stress = fc;
        } else {
          // 脆性下降
          stress = fc * Math.exp(-15 * (strain - epsilon0) / epsilon0);
        }
        break;
      }
    }
    
    data.push({ strain: strain * 1000, stress: Math.max(0, stress) });
  }
  
  return data;
}

// 混凝土模型列表
const CONCRETE_MODELS: ModelType[] = [
  'hognestad', 'eurocode', 'chinese_parabola', 'chinese_damage',
  'mander', 'kent_park', 'popovics', 'carreira_chu', 'thorenfeldt', 'ceb_fip'
];

export const ConstitutivePage: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>('hognestad');
  const [strength, setStrength] = useState(30);
  const [elasticModulus, setElasticModulus] = useState(30000);
  const [confinementRatio, setConfinementRatio] = useState(1.0); // 约束系数
  const [compareModels, setCompareModels] = useState<ModelType[]>([]);
  const [showCategory, setShowCategory] = useState<'concrete' | 'all'>('concrete');

  const modelInfo = MODELS[selectedModel];
  
  // 根据强度自动计算弹性模量（可选）
  const autoE = useMemo(() => Math.round(4730 * Math.sqrt(strength)), [strength]);
  
  // 生成主曲线数据
  const mainCurveData = useMemo(() => 
    generateCurveData(selectedModel, strength, elasticModulus, confinementRatio),
    [selectedModel, strength, elasticModulus, confinementRatio]
  );
  
  // 生成对比曲线数据
  const compareCurveData = useMemo(() => 
    compareModels.map(model => ({
      model,
      data: generateCurveData(model, strength, elasticModulus, confinementRatio)
    })),
    [compareModels, strength, elasticModulus, confinementRatio]
  );

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  // 过滤显示的模型
  const displayModels = showCategory === 'concrete' 
    ? Object.entries(MODELS).filter(([key]) => CONCRETE_MODELS.includes(key as ModelType))
    : Object.entries(MODELS);

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">材料本构关系 Constitutive Models</h2>
          <p className="text-xs text-slate-500 mt-1">探索不同材料的应力-应变关系模型</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* 左侧：模型选择 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-auto">
          {/* 分类切换 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowCategory('concrete')}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                showCategory === 'concrete'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              混凝土模型 ({CONCRETE_MODELS.length})
            </button>
            <button
              onClick={() => setShowCategory('all')}
              className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${
                showCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              全部模型
            </button>
          </div>
          
          <div className="space-y-1.5 max-h-[280px] overflow-auto pr-1">
            {displayModels.map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedModel(key as ModelType)}
                className={`w-full text-left p-2.5 rounded-lg transition-all ${
                  selectedModel === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{info.name}</span>
                  {info.year && <span className="text-[9px] opacity-50">{info.year}</span>}
                </div>
                <div className="text-[10px] opacity-70">{info.nameEn}</div>
              </button>
            ))}
          </div>

          {/* 参数调节 */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 mb-3">参数设置 Parameters</h4>
            
            <div className="space-y-3">
              {/* 强度 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">抗压强度 f<sub>c</sub></span>
                  <span className="text-white font-mono">{strength} MPa</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  value={strength}
                  onChange={(e) => setStrength(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                  <span>C15</span>
                  <span>C50</span>
                  <span>C100</span>
                </div>
              </div>
              
              {/* 弹性模量 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">弹性模量 E<sub>c</sub></span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono">{(elasticModulus / 1000).toFixed(1)} GPa</span>
                    <button
                      onClick={() => setElasticModulus(autoE)}
                      className="text-[9px] text-blue-400 hover:text-blue-300"
                      title={`自动计算: ${(autoE/1000).toFixed(1)} GPa`}
                    >
                      [自动]
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="50000"
                  step="500"
                  value={elasticModulus}
                  onChange={(e) => setElasticModulus(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
              
              {/* 约束系数 - 仅对约束模型显示 */}
              {(selectedModel === 'mander' || selectedModel === 'kent_park') && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">约束系数 K</span>
                    <span className="text-white font-mono">{confinementRatio.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.05"
                    value={confinementRatio}
                    onChange={(e) => setConfinementRatio(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="text-[9px] text-slate-600 mt-0.5">
                    1.0 = 无约束, 1.5~2.0 = 良好约束
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 对比模型 */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400">对比模型 Compare</h4>
              {compareModels.length > 0 && (
                <button
                  onClick={() => setCompareModels([])}
                  className="text-[9px] text-slate-500 hover:text-white"
                >
                  清除
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayModels.map(([key, info]) => (
                key !== selectedModel && (
                  <button
                    key={key}
                    onClick={() => {
                      if (compareModels.includes(key as ModelType)) {
                        setCompareModels(compareModels.filter(m => m !== key));
                      } else if (compareModels.length < 5) {
                        setCompareModels([...compareModels, key as ModelType]);
                      }
                    }}
                    className={`px-2 py-1 text-[9px] rounded transition-all ${
                      compareModels.includes(key as ModelType)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-500 hover:text-white'
                    }`}
                  >
                    {info.name.replace(' 模型', '').replace('中国规范', 'GB')}
                  </button>
                )
              ))}
            </div>
            <div className="text-[9px] text-slate-600 mt-2">
              最多选择 5 个对比模型
            </div>
          </div>
        </div>

        {/* 中间：图表 */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col">
          <h3 className="text-sm font-bold text-white mb-2">应力-应变曲线 Stress-Strain Curve</h3>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="strain"
                  type="number"
                  domain={[0, 'auto']}
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  label={{ value: 'ε (‰)', position: 'bottom', fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  label={{ value: 'σ (MPa)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} MPa`, '应力']}
                  labelFormatter={(label) => `应变: ${Number(label).toFixed(3)} ‰`}
                />
                <Legend />
                
                {/* 主曲线 */}
                <Line
                  data={mainCurveData}
                  type="monotone"
                  dataKey="stress"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  name={modelInfo.name}
                />
                
                {/* 对比曲线 */}
                {compareCurveData.map((curve, index) => (
                  <Line
                    key={curve.model}
                    data={curve.data}
                    type="monotone"
                    dataKey="stress"
                    stroke={colors[index % colors.length]}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name={MODELS[curve.model].name}
                  />
                ))}
                
                {/* 参考线 */}
                <ReferenceLine y={strength} stroke="#ef4444" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 模型信息 */}
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-bold text-white">{modelInfo.name}</h4>
                  {modelInfo.year && (
                    <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px]">
                      {modelInfo.year}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{modelInfo.description}</p>
                {modelInfo.reference && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    📚 {modelInfo.reference}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">适用:</span>
                {modelInfo.applicable.map(mat => (
                  <span key={mat} className="px-2 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300">
                    {MATERIAL_INFO[mat].name}
                  </span>
                ))}
              </div>
            </div>
            
            {/* 公式显示 - 使用 KaTeX 渲染 */}
            <div className="mb-3">
              <div className="text-[10px] text-slate-500 mb-2">本构方程 Constitutive Equation</div>
              <FormulaBlock formula={modelInfo.formula} />
            </div>
            
            {/* 符号说明 */}
            <div className="mb-3">
              <div className="text-[10px] text-slate-500 mb-2">符号说明 Symbol Definitions</div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                  {modelInfo.symbols.map((sym, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-12 text-center">
                        <InlineFormula formula={sym.symbol} />
                      </span>
                      <span className="text-slate-400">—</span>
                      <span className="text-slate-300 flex-1">{sym.meaning}</span>
                      {sym.unit && sym.unit !== '-' && (
                        <span className="text-slate-500 text-[10px]">[{sym.unit}]</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-500">
              <div className="flex items-center gap-4">
                <span>峰值应变 ε₀ ≈ {(0.002 + (strength - 30) * 0.00001).toFixed(4)}</span>
                <span>E/f<sub>c</sub> = {(elasticModulus / strength).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">当前参数:</span>
                <span className="text-blue-400">f<sub>c</sub>={strength} MPa</span>
                <span className="text-green-400">E={(elasticModulus/1000).toFixed(1)} GPa</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
