import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Trash2, 
  Download, 
  Upload, 
  Search, 
  Filter,
  ChevronRight,
  FileText,
  BarChart3,
  Clock,
  Beaker,
  X,
  Play,
  AlertTriangle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { TestType, MaterialType } from '../types';
import {
  TestRecord,
  TestRecordSummary,
  getRecordSummaries,
  getRecordById,
  deleteRecord,
  clearAllRecords,
  exportRecordToFile,
  importRecordFromFile,
  getStatistics,
} from '../services/historyService';

// 材料类型显示名称
const MATERIAL_NAMES: Record<MaterialType, string> = {
  [MaterialType.CONCRETE]: '普通混凝土',
  [MaterialType.HPC]: '高性能混凝土',
  [MaterialType.FRC]: '纤维混凝土',
  [MaterialType.LAC]: '轻骨料混凝土',
  [MaterialType.SCC]: '自密实混凝土',
  [MaterialType.STEEL]: '钢材',
  [MaterialType.ROCK]: '岩石',
  [MaterialType.MORTAR]: '砂浆',
  [MaterialType.BRICK]: '砖块',
};

// 试验类型显示名称
const TEST_TYPE_NAMES: Record<TestType, string> = {
  [TestType.COMPRESSION]: '抗压试验',
  [TestType.TENSION]: '劈裂抗拉',
  [TestType.ELASTIC_MODULUS]: '弹性模量',
};

// 控制模式显示名称
const CONTROL_MODE_NAMES: Record<string, string> = {
  'stress': '应力控制',
  'displacement': '位移控制',
  'program': '程序控制',
};

export const HistoryPage: React.FC = () => {
  const [records, setRecords] = useState<TestRecordSummary[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TestRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | TestType>('all');
  const [filterMaterial, setFilterMaterial] = useState<'all' | MaterialType>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statistics, setStatistics] = useState<ReturnType<typeof getStatistics>>(null);

  // 加载记录
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = () => {
    setRecords(getRecordSummaries());
    setStatistics(getStatistics());
  };

  // 过滤记录
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 搜索过滤
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchMaterial = MATERIAL_NAMES[record.materialType].toLowerCase().includes(searchLower);
        const matchType = TEST_TYPE_NAMES[record.testType].toLowerCase().includes(searchLower);
        const matchDate = record.date.includes(searchTerm);
        const matchStrength = record.targetStrength.toString().includes(searchTerm);
        if (!matchMaterial && !matchType && !matchDate && !matchStrength) {
          return false;
        }
      }
      // 类型过滤
      if (filterType !== 'all' && record.testType !== filterType) {
        return false;
      }
      // 材料过滤
      if (filterMaterial !== 'all' && record.materialType !== filterMaterial) {
        return false;
      }
      return true;
    });
  }, [records, searchTerm, filterType, filterMaterial]);

  // 查看记录详情
  const viewRecord = (id: string) => {
    const record = getRecordById(id);
    setSelectedRecord(record);
  };

  // 删除记录
  const handleDelete = (id: string) => {
    deleteRecord(id);
    loadRecords();
    setShowDeleteConfirm(null);
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  // 清空所有记录
  const handleClearAll = () => {
    clearAllRecords();
    loadRecords();
    setSelectedRecord(null);
    setShowClearConfirm(false);
  };

  // 导出记录
  const handleExport = (record: TestRecord) => {
    exportRecordToFile(record);
  };

  // 导入记录
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      await importRecordFromFile(file);
      loadRecords();
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败');
    }
    e.target.value = ''; // 重置input
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History size={20} />
            试验历史 Test History
          </h2>
          <p className="text-xs text-slate-500 mt-1">查看和管理历史试验记录</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 导入按钮 */}
          <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload size={14} />
            导入
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          
          {/* 清空按钮 */}
          {records.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-xs text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} />
              清空
            </button>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">总试验数</div>
            <div className="text-lg font-bold text-white">{statistics.totalTests}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">抗压试验</div>
            <div className="text-lg font-bold text-blue-400">{statistics.compressionTests}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">抗拉试验</div>
            <div className="text-lg font-bold text-green-400">{statistics.tensionTests}</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">平均强度</div>
            <div className="text-lg font-bold text-amber-400">{statistics.avgPeakStress} <span className="text-xs font-normal">MPa</span></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">最高强度</div>
            <div className="text-lg font-bold text-emerald-400">{statistics.maxPeakStress} <span className="text-xs font-normal">MPa</span></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">最低强度</div>
            <div className="text-lg font-bold text-red-400">{statistics.minPeakStress} <span className="text-xs font-normal">MPa</span></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500">最近试验</div>
            <div className="text-xs font-medium text-slate-300 truncate">{statistics.lastTestDate}</div>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* 左侧：记录列表 */}
        <div className="lg:col-span-1 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
          {/* 搜索和过滤 */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="搜索记录..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | TestType)}
                className="flex-1 px-2 py-1.5 bg-slate-800 rounded text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">全部类型</option>
                <option value={TestType.COMPRESSION}>抗压试验</option>
                <option value={TestType.TENSION}>劈裂抗拉</option>
                <option value={TestType.ELASTIC_MODULUS}>弹性模量</option>
              </select>
              <select
                value={filterMaterial}
                onChange={(e) => setFilterMaterial(e.target.value as 'all' | MaterialType)}
                className="flex-1 px-2 py-1.5 bg-slate-800 rounded text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">全部材料</option>
                {Object.entries(MATERIAL_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 记录列表 */}
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <FileText size={40} strokeWidth={1} />
                <p className="text-sm mt-2">暂无试验记录</p>
                <p className="text-xs mt-1">完成试验后记录将自动保存</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => viewRecord(record.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedRecord?.id === record.id
                      ? 'bg-blue-600/20 border border-blue-500/50'
                      : 'bg-slate-800/50 hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          record.testType === TestType.COMPRESSION 
                            ? 'bg-blue-900/50 text-blue-300' 
                            : 'bg-green-900/50 text-green-300'
                        }`}>
                          {TEST_TYPE_NAMES[record.testType]}
                        </span>
                        <span className="text-xs text-slate-400">
                          {MATERIAL_NAMES[record.materialType]}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-white mt-1">
                        {record.targetStrength} MPa · {record.specimenSize}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {record.date}
                        </span>
                        <span>{CONTROL_MODE_NAMES[record.controlMode]}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-400">
                        {record.results.peakStress.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-500">MPa</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧：记录详情 */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
          {selectedRecord ? (
            <>
              {/* 详情头部 */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedRecord.testType === TestType.COMPRESSION 
                        ? 'bg-blue-900/50 text-blue-300' 
                        : 'bg-green-900/50 text-green-300'
                    }`}>
                      {TEST_TYPE_NAMES[selectedRecord.testType]}
                    </span>
                    <span className="text-sm text-white font-medium">
                      {MATERIAL_NAMES[selectedRecord.materialType]} · {selectedRecord.targetStrength} MPa
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedRecord.date} · {selectedRecord.specimenSize} · {CONTROL_MODE_NAMES[selectedRecord.controlMode]}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport(selectedRecord)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="导出记录"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(selectedRecord.id)}
                    className="p-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-red-400 transition-colors"
                    title="删除记录"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 结果摘要 */}
              <div className="p-4 border-b border-slate-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500">峰值荷载</div>
                    <div className="text-xl font-bold text-white">
                      {selectedRecord.results.peakLoad.toFixed(2)}
                      <span className="text-xs font-normal text-slate-400 ml-1">kN</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500">峰值应力</div>
                    <div className="text-xl font-bold text-amber-400">
                      {selectedRecord.results.peakStress.toFixed(2)}
                      <span className="text-xs font-normal text-slate-400 ml-1">MPa</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500">峰值应变</div>
                    <div className="text-xl font-bold text-blue-400">
                      {(selectedRecord.results.peakStrain * 1000).toFixed(3)}
                      <span className="text-xs font-normal text-slate-400 ml-1">×10⁻³</span>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500">试验时长</div>
                    <div className="text-xl font-bold text-green-400">
                      {selectedRecord.results.duration.toFixed(1)}
                      <span className="text-xs font-normal text-slate-400 ml-1">s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 曲线图 */}
              <div className="flex-1 p-4 min-h-0">
                <div className="h-full bg-slate-800/30 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-2">应力-应变曲线</div>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={selectedRecord.dataPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="strain" 
                        tickFormatter={(v) => (v * 1000).toFixed(1)}
                        stroke="#64748b"
                        fontSize={10}
                        label={{ value: '应变 (×10⁻³)', position: 'bottom', offset: -5, fill: '#64748b', fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={10}
                        label={{ value: '应力 (MPa)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelFormatter={(v) => `应变: ${(Number(v) * 1000).toFixed(3)} ×10⁻³`}
                        formatter={(value: number) => [`${value.toFixed(2)} MPa`, '应力']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="stress" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <BarChart3 size={60} strokeWidth={1} />
              <p className="text-sm mt-4">选择一条记录查看详情</p>
              <p className="text-xs mt-1">点击左侧列表中的记录</p>
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <AlertTriangle size={24} />
              <span className="text-lg font-bold">确认删除</span>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              确定要删除这条试验记录吗？此操作无法撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 清空确认对话框 */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle size={24} />
              <span className="text-lg font-bold">清空所有记录</span>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              确定要清空所有试验记录吗？此操作无法撤销，所有 {records.length} 条记录将被永久删除。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white transition-colors"
              >
                清空全部
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
