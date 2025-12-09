// 试验历史记录服务
import { TestType, MaterialType, DataPoint } from '../types';

// 试验记录接口
export interface TestRecord {
  id: string;
  timestamp: number;
  date: string;
  testType: TestType;
  materialType: MaterialType;
  specimenSize: string;
  targetStrength: number;
  controlMode: 'force' | 'displacement' | 'program';
  results: {
    peakLoad: number;      // kN
    peakStress: number;    // MPa
    peakStrain: number;    // 峰值应变
    elasticModulus?: number; // GPa
    duration: number;      // 试验时长 (s)
    cycleCount?: number;   // 循环次数（程序控制模式）
  };
  dataPoints: DataPoint[];
  notes?: string;
}

// 历史记录摘要（用于列表显示，不包含完整数据点）
export interface TestRecordSummary {
  id: string;
  timestamp: number;
  date: string;
  testType: TestType;
  materialType: MaterialType;
  specimenSize: string;
  targetStrength: number;
  controlMode: 'force' | 'displacement' | 'program';
  results: {
    peakLoad: number;
    peakStress: number;
    peakStrain: number;
    elasticModulus?: number;
    duration: number;
    cycleCount?: number;
  };
  notes?: string;
}

const STORAGE_KEY = 'concretelab_test_history';
const MAX_RECORDS = 50; // 最多保存50条记录

// 生成唯一ID
const generateId = (): string => {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 保存试验记录
export const saveTestRecord = (record: Omit<TestRecord, 'id' | 'timestamp' | 'date'>): TestRecord => {
  const timestamp = Date.now();
  const newRecord: TestRecord = {
    ...record,
    id: generateId(),
    timestamp,
    date: formatDate(timestamp),
  };

  const records = getAllRecords();
  records.unshift(newRecord); // 新记录放在最前面
  
  // 限制记录数量
  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return newRecord;
};

// 获取所有记录
export const getAllRecords = (): TestRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// 获取记录摘要列表（不包含数据点，用于快速加载）
export const getRecordSummaries = (): TestRecordSummary[] => {
  const records = getAllRecords();
  return records.map(({ dataPoints, ...summary }) => summary);
};

// 根据ID获取完整记录
export const getRecordById = (id: string): TestRecord | null => {
  const records = getAllRecords();
  return records.find(r => r.id === id) || null;
};

// 删除记录
export const deleteRecord = (id: string): boolean => {
  const records = getAllRecords();
  const index = records.findIndex(r => r.id === id);
  if (index !== -1) {
    records.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  }
  return false;
};

// 清空所有记录
export const clearAllRecords = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// 更新记录备注
export const updateRecordNotes = (id: string, notes: string): boolean => {
  const records = getAllRecords();
  const record = records.find(r => r.id === id);
  if (record) {
    record.notes = notes;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  }
  return false;
};

// 导出记录为JSON文件
export const exportRecordToFile = (record: TestRecord): void => {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `test_${record.materialType}_${record.targetStrength}MPa_${record.date.replace(/[/:]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// 从文件导入记录
export const importRecordFromFile = (file: File): Promise<TestRecord> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const record = JSON.parse(e.target?.result as string) as TestRecord;
        // 验证记录格式
        if (!record.testType || !record.materialType || !record.dataPoints) {
          reject(new Error('无效的试验记录文件'));
          return;
        }
        // 生成新ID避免冲突
        record.id = generateId();
        record.timestamp = Date.now();
        record.date = formatDate(record.timestamp);
        
        const records = getAllRecords();
        records.unshift(record);
        if (records.length > MAX_RECORDS) {
          records.splice(MAX_RECORDS);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        resolve(record);
      } catch {
        reject(new Error('文件解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
};

// 获取统计信息
export const getStatistics = () => {
  const records = getAllRecords();
  if (records.length === 0) {
    return null;
  }

  const compressionTests = records.filter(r => r.testType === TestType.COMPRESSION);
  const tensionTests = records.filter(r => r.testType === TestType.TENSION);
  const modulusTests = records.filter(r => r.testType === TestType.ELASTIC_MODULUS);
  
  const avgPeakStress = records.reduce((sum, r) => sum + r.results.peakStress, 0) / records.length;
  const maxPeakStress = Math.max(...records.map(r => r.results.peakStress));
  const minPeakStress = Math.min(...records.map(r => r.results.peakStress));

  return {
    totalTests: records.length,
    compressionTests: compressionTests.length,
    tensionTests: tensionTests.length,
    modulusTests: modulusTests.length,
    avgPeakStress: avgPeakStress.toFixed(2),
    maxPeakStress: maxPeakStress.toFixed(2),
    minPeakStress: minPeakStress.toFixed(2),
    lastTestDate: records[0]?.date || '-',
  };
};
