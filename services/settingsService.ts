/**
 * 全局设置服务
 * 管理本构模型、显示设置等全局配置
 */

// 本构模型类型
export type ConstitutiveModelType = 
  | 'hognestad' 
  | 'eurocode' 
  | 'chinese_parabola'
  | 'mander' 
  | 'kent_park'
  | 'gb50010'
  | 'damage'
  | 'linear';

// 本构模型配置
export interface ConstitutiveModelConfig {
  type: ConstitutiveModelType;
  name: string;
  description: string;
  params: {
    // 通用参数
    fc?: number;        // 抗压强度 (MPa)
    epsilon0?: number;  // 峰值应变
    epsilonU?: number;  // 极限应变
    // Mander 模型特有参数
    fcc?: number;       // 约束混凝土强度
    epsilonCC?: number; // 约束混凝土峰值应变
    // Eurocode 模型特有参数
    fcm?: number;       // 平均抗压强度
    Ecm?: number;       // 平均弹性模量
  };
}

// 预定义本构模型
export const CONSTITUTIVE_MODELS: ConstitutiveModelConfig[] = [
  {
    type: 'hognestad',
    name: 'Hognestad 抛物线模型',
    description: '经典混凝土本构模型，适用于普通混凝土单轴压缩',
    params: {}
  },
  {
    type: 'gb50010',
    name: 'GB 50010 中国规范模型',
    description: '中国混凝土结构设计规范 GB 50010-2010 本构模型',
    params: {}
  },
  {
    type: 'damage',
    name: '损伤本构模型',
    description: '基于连续损伤力学的混凝土本构模型，考虑刚度退化',
    params: {}
  },
  {
    type: 'mander',
    name: 'Mander 约束混凝土模型',
    description: '考虑横向约束效应的混凝土本构模型',
    params: {}
  },
  {
    type: 'eurocode',
    name: 'Eurocode 2 模型',
    description: '欧洲规范 EN 1992-1-1 混凝土本构模型',
    params: {}
  },
  {
    type: 'linear',
    name: '线弹性模型',
    description: '简化的线弹性本构模型，仅用于弹性分析',
    params: {}
  }
];

// 全局设置接口
export interface GlobalSettings {
  // 本构模型设置
  constitutiveModel: ConstitutiveModelType;
  customParams: {
    fc?: number;
    epsilon0?: number;
    epsilonU?: number;
    fcc?: number;
    epsilonCC?: number;
  };
  useCustomParams: boolean;
  
  // 显示设置
  animationSpeed: number;
  showGrid: boolean;
  soundEnabled: boolean;
  theme: 'dark' | 'light';
  language: 'zh' | 'en' | 'both';
}

// 默认设置
const DEFAULT_SETTINGS: GlobalSettings = {
  constitutiveModel: 'hognestad',
  customParams: {},
  useCustomParams: false,
  animationSpeed: 1,
  showGrid: true,
  soundEnabled: false,
  theme: 'dark',
  language: 'both'
};

const STORAGE_KEY = 'concretelab_settings';

// 加载设置
export function loadSettings(): GlobalSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

// 保存设置
export function saveSettings(settings: Partial<GlobalSettings>): void {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// 获取当前本构模型配置
export function getCurrentConstitutiveModel(): ConstitutiveModelConfig {
  const settings = loadSettings();
  const model = CONSTITUTIVE_MODELS.find(m => m.type === settings.constitutiveModel);
  
  if (!model) {
    return CONSTITUTIVE_MODELS[0];
  }
  
  // 如果使用自定义参数，合并到模型配置中
  if (settings.useCustomParams) {
    return {
      ...model,
      params: { ...model.params, ...settings.customParams }
    };
  }
  
  return model;
}
