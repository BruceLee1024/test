import React, { useState } from 'react';
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react';
import { FormulaBlock, InlineFormula } from './MathFormula';

interface TheorySection {
  id: string;
  title: string;
  titleEn: string;
  content: React.ReactNode;
}

const theorySections: TheorySection[] = [
  // ==================== 1. 混凝土抗压试验 ====================
  {
    id: 'compression',
    title: '混凝土抗压试验',
    titleEn: 'Compression Test',
    content: (
      <div className="space-y-5">
        <section>
          <h4 className="text-base font-bold text-white mb-2">1. 概述</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            混凝土抗压强度试验是评定混凝土力学性能最基本、最重要的试验方法，也是混凝土质量控制的核心指标。
            抗压强度是混凝土结构设计的主要依据，直接影响结构的承载能力和安全性。
          </p>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">2. 试验标准</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-blue-400 font-bold text-sm mb-1">中国标准</div>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• GB/T 50081-2019 普通混凝土力学性能试验方法标准</li>
                <li>• GB 50010-2010 混凝土结构设计规范</li>
              </ul>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-green-400 font-bold text-sm mb-1">国际标准</div>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• ASTM C39 圆柱体试件抗压强度试验</li>
                <li>• EN 12390-3 硬化混凝土抗压强度试验</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">3. 试件规格</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400">试件类型</th>
                  <th className="text-left py-2 text-slate-400">尺寸 (mm)</th>
                  <th className="text-left py-2 text-slate-400">适用标准</th>
                  <th className="text-left py-2 text-slate-400">换算系数</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr className="border-b border-slate-800">
                  <td className="py-2">标准立方体</td>
                  <td>150×150×150</td>
                  <td>GB (基准)</td>
                  <td>1.00</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2">小立方体</td>
                  <td>100×100×100</td>
                  <td>GB</td>
                  <td>0.95</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="py-2">标准圆柱体</td>
                  <td>Φ150×300</td>
                  <td>ASTM/EN</td>
                  <td>0.79~0.83</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">4. 强度计算</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <FormulaBlock formula={String.raw`f_{cu} = \frac{F}{A}`} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
              <div><InlineFormula formula="f_{cu}" /><div className="text-slate-500">立方体抗压强度 (MPa)</div></div>
              <div><InlineFormula formula="F" /><div className="text-slate-500">破坏荷载 (N)</div></div>
              <div><InlineFormula formula="A" /><div className="text-slate-500">承压面积 (mm²)</div></div>
            </div>
          </div>
          
          <div className="mt-3 bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">强度换算关系</div>
            <FormulaBlock formula={String.raw`f_c = 0.76 f_{cu}, \quad f_{ck} = 0.88 \times 0.76 f_{cu} = 0.67 f_{cu}`} />
            <div className="mt-2 text-xs text-slate-500">
              <InlineFormula formula="f_c" /> — 轴心抗压强度，
              <InlineFormula formula="f_{ck}" /> — 轴心抗压强度标准值
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">5. 破坏形态</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm font-medium text-white">立方体试件</div>
              <div className="text-xs text-slate-400 mt-1">四角锥破坏（正常）</div>
              <p className="text-xs text-slate-500 mt-2">
                由于端部摩擦约束，形成两个对顶的四角锥体
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">🔷</div>
              <div className="text-sm font-medium text-white">圆柱体试件</div>
              <div className="text-xs text-slate-400 mt-1">圆锥破坏（正常）</div>
              <p className="text-xs text-slate-500 mt-2">
                形成上下两个圆锥体，侧面产生斜向裂缝
              </p>
            </div>
          </div>
        </section>

        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
          <h4 className="text-sm font-bold text-yellow-400 mb-2">⚠️ 注意事项</h4>
          <ul className="space-y-1 text-xs text-slate-400">
            <li>• 加载偏心会导致一侧先破坏，强度偏低</li>
            <li>• 加载速率过快强度偏高，过慢强度偏低</li>
            <li>• 端面不平应使用硫磺胶泥或石膏找平</li>
            <li>• 湿试件强度比干试件低约 10%~15%</li>
          </ul>
        </div>
      </div>
    ),
  },

  // ==================== 2. 劈裂抗拉试验 ====================
  {
    id: 'splitting',
    title: '劈裂抗拉试验',
    titleEn: 'Splitting Tensile Test',
    content: (
      <div className="space-y-5">
        <section>
          <h4 className="text-base font-bold text-white mb-2">1. 概述</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            劈裂抗拉试验（又称巴西试验）是测定混凝土抗拉强度的间接方法。
            由于混凝土直接拉伸试验操作困难、离散性大，工程中常采用劈裂法测定抗拉强度。
          </p>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">2. 试验原理</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm text-slate-300 mb-3">
              沿圆柱体直径方向施加线荷载，在垂直于加载面的直径平面上产生近似均匀分布的拉应力，
              当拉应力达到混凝土抗拉强度时，试件沿加载直径面劈裂破坏。
            </p>
            <FormulaBlock formula={String.raw`\sigma_t = \frac{2P}{\pi d t}`} />
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">3. 强度计算</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">圆柱体试件</div>
            <FormulaBlock formula={String.raw`f_{ts} = \frac{2F}{\pi d L} = 0.637 \frac{F}{dL}`} />
            <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-center">
              <div><InlineFormula formula="f_{ts}" /><div className="text-slate-500">劈拉强度</div></div>
              <div><InlineFormula formula="F" /><div className="text-slate-500">破坏荷载</div></div>
              <div><InlineFormula formula="d" /><div className="text-slate-500">直径</div></div>
              <div><InlineFormula formula="L" /><div className="text-slate-500">长度</div></div>
            </div>
          </div>

          <div className="mt-3 bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">与抗压强度的关系</div>
            <FormulaBlock formula={String.raw`f_t \approx 0.55 \sqrt{f_{cu}} \approx (0.05 \sim 0.10) f_c`} />
            <div className="text-xs text-slate-500 mt-2">
              混凝土抗拉强度约为抗压强度的 1/10~1/20
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">4. 垫条要求</h4>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• 材料：胶合板或硬纸板</li>
              <li>• 宽度：圆柱体直径的 1/12（约 12~15mm）</li>
              <li>• 厚度：3~4mm</li>
              <li>• 长度：不小于试件长度</li>
            </ul>
          </div>
        </section>

        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
          <h4 className="text-sm font-bold text-yellow-400 mb-2">⚠️ 注意事项</h4>
          <ul className="space-y-1 text-xs text-slate-400">
            <li>• 垫条必须与试件母线对齐，确保荷载沿直径方向</li>
            <li>• 加载速率：0.02~0.05 MPa/s</li>
            <li>• 正常破坏应沿加载直径面劈裂成两半</li>
          </ul>
        </div>
      </div>
    ),
  },

  // ==================== 3. 弹性模量试验 ====================
  {
    id: 'elastic_modulus',
    title: '弹性模量试验',
    titleEn: 'Elastic Modulus Test',
    content: (
      <div className="space-y-5">
        <section>
          <h4 className="text-base font-bold text-white mb-2">1. 概述</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            弹性模量是描述材料抵抗弹性变形能力的物理量，是结构变形计算和裂缝控制的重要参数。
            混凝土弹性模量通常指静力受压弹性模量，通过棱柱体试件轴心受压试验测定。
          </p>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">2. 基本概念</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-blue-400 font-bold text-sm mb-1">初始切线模量 E₀</div>
              <p className="text-xs text-slate-400">应力-应变曲线原点处切线斜率</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-green-400 font-bold text-sm mb-1">割线模量 Ec</div>
              <p className="text-xs text-slate-400">原点与曲线上某点连线斜率</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-orange-400 font-bold text-sm mb-1">切线模量 Et</div>
              <p className="text-xs text-slate-400">曲线上某点切线斜率</p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">3. 计算公式</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <FormulaBlock formula={String.raw`E_c = \frac{\sigma_a - \sigma_0}{\varepsilon_a - \varepsilon_0} = \frac{\Delta \sigma}{\Delta \varepsilon}`} />
            <div className="mt-3 text-xs text-slate-500">
              <InlineFormula formula="\sigma_a" /> — 应力上限（1/3 fc），
              <InlineFormula formula="\sigma_0" /> — 应力下限（0.5 MPa）
            </div>
          </div>

          <div className="mt-3 bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">经验公式</div>
            <FormulaBlock formula={String.raw`E_c = \frac{10^5}{2.2 + \frac{34.7}{f_{cu}}} \quad \text{(GB 50010)}`} />
            <FormulaBlock formula={String.raw`E_c = 4730\sqrt{f'_c} \quad \text{(ACI 318)}`} className="mt-2" />
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">4. 典型值</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400">强度等级</th>
                  <th className="text-center py-2 text-slate-400">C20</th>
                  <th className="text-center py-2 text-slate-400">C30</th>
                  <th className="text-center py-2 text-slate-400">C40</th>
                  <th className="text-center py-2 text-slate-400">C50</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                <tr>
                  <td className="py-2">Ec (×10⁴ MPa)</td>
                  <td className="text-center">2.55</td>
                  <td className="text-center">3.00</td>
                  <td className="text-center">3.25</td>
                  <td className="text-center">3.45</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    ),
  },

  // ==================== 4. 本构关系理论 ====================
  {
    id: 'constitutive',
    title: '本构关系理论',
    titleEn: 'Constitutive Theory',
    content: (
      <div className="space-y-5">
        <section>
          <h4 className="text-base font-bold text-white mb-2">1. 概述</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            材料本构关系描述了材料在外力作用下应力与应变之间的关系，
            是连续介质力学的核心内容，也是有限元分析和结构非线性计算的基础。
          </p>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">2. 应力-应变曲线阶段</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="space-y-2">
              {[
                { phase: '弹性阶段', range: '0~0.3fc', color: 'text-green-400', desc: '近似线性，卸载可恢复' },
                { phase: '弹塑性阶段', range: '0.3~0.8fc', color: 'text-blue-400', desc: '曲线弯曲，出现不可恢复变形' },
                { phase: '塑性阶段', range: '0.8fc~fc', color: 'text-yellow-400', desc: '斜率降低，微裂缝发展' },
                { phase: '下降段', range: 'fc~破坏', color: 'text-red-400', desc: '承载力下降，软化特性' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className={`${item.color} font-bold w-20`}>{item.phase}</span>
                  <span className="text-slate-500 w-20">{item.range}</span>
                  <span className="text-slate-400">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">3. 混凝土本构特点</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-blue-400 font-bold text-sm mb-1">非线性</div>
              <p className="text-xs text-slate-400">应力-应变呈明显非线性</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-green-400 font-bold text-sm mb-1">软化特性</div>
              <p className="text-xs text-slate-400">峰值后承载力下降</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-orange-400 font-bold text-sm mb-1">拉压不对称</div>
              <p className="text-xs text-slate-400">抗拉强度仅为抗压的1/10~1/20</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-purple-400 font-bold text-sm mb-1">率相关性</div>
              <p className="text-xs text-slate-400">强度与加载速率有关</p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">4. 经典本构模型</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-sm font-medium text-white mb-2">Hognestad 模型 (1951)</div>
            <FormulaBlock formula={String.raw`\sigma = f_c \left[ 2\frac{\varepsilon}{\varepsilon_0} - \left(\frac{\varepsilon}{\varepsilon_0}\right)^2 \right]`} />
            <p className="text-xs text-slate-400 mt-2">
              最经典的混凝土本构模型，上升段为抛物线，简单实用。
            </p>
          </div>
        </section>

        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
          <h4 className="text-sm font-bold text-blue-400 mb-2">💡 提示</h4>
          <p className="text-xs text-slate-400">
            更多本构模型详情请访问"本构关系"标签页，可交互调整参数查看曲线变化。
          </p>
        </div>
      </div>
    ),
  },

  // ==================== 5. 循环加载与滞回 ====================
  {
    id: 'cyclic',
    title: '循环加载与滞回',
    titleEn: 'Cyclic Loading & Hysteresis',
    content: (
      <div className="space-y-5">
        <section>
          <h4 className="text-base font-bold text-white mb-2">1. 概述</h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            循环加载试验用于研究材料在反复荷载（地震、风振、疲劳）作用下的力学行为。
            通过分析滞回曲线，可以评估结构的耗能能力、延性和抗震性能。
          </p>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">2. 滞回曲线</h4>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-sm text-slate-300 mb-3">
              滞回曲线是循环加载过程中荷载-位移关系曲线，加载和卸载路径不重合，形成闭合环。
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-green-400 font-bold mb-1">理想特征</div>
                <ul className="text-slate-400 space-y-0.5">
                  <li>• 形状饱满，面积大</li>
                  <li>• 各圈曲线稳定</li>
                  <li>• 刚度退化缓慢</li>
                </ul>
              </div>
              <div>
                <div className="text-red-400 font-bold mb-1">不良特征</div>
                <ul className="text-slate-400 space-y-0.5">
                  <li>• 形状瘦长，面积小</li>
                  <li>• 明显捏拢现象</li>
                  <li>• 刚度快速退化</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">3. 性能指标</h4>
          <div className="space-y-3">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-2">耗能能力</div>
              <FormulaBlock formula={String.raw`E_d = \oint F \, d\delta = \text{滞回环面积}`} />
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-2">等效粘滞阻尼比</div>
              <FormulaBlock formula={String.raw`\xi_{eq} = \frac{E_d}{2\pi E_s}`} />
              <p className="text-xs text-slate-500 mt-2">一般要求 ξ ≥ 0.1</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-2">位移延性系数</div>
              <FormulaBlock formula={String.raw`\mu = \frac{\Delta_u}{\Delta_y}`} />
              <p className="text-xs text-slate-500 mt-2">抗震设计一般要求 μ ≥ 3~4</p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="text-base font-bold text-white mb-2">4. 退化现象</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-orange-400 font-bold text-sm mb-1">刚度退化</div>
              <p className="text-xs text-slate-400">循环次数增加，滞回曲线斜率降低</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-red-400 font-bold text-sm mb-1">强度退化</div>
              <p className="text-xs text-slate-400">相同位移下，峰值荷载降低</p>
            </div>
          </div>
        </section>

        <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4">
          <h4 className="text-sm font-bold text-purple-400 mb-2">💡 虚拟实验室提示</h4>
          <p className="text-xs text-slate-400">
            选择"程序控制"模式可进行循环加载试验，观察滞回曲线形成过程。
          </p>
        </div>
      </div>
    ),
  },

  // ==================== 6. 试验机原理 ====================
  {
    id: 'machine',
    title: '试验机工作原理',
    titleEn: 'Testing Machine Principles',
    content: (
      <div className="space-y-6">
        {/* 概述卡片 */}
        <section className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-5 border border-blue-800/30">
          <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs">1</span>
            概述
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed">
            材料试验机是测定材料力学性能的专用设备，广泛应用于科研院所、质检机构和工程现场。
            现代试验机多采用<span className="text-blue-400 font-medium">电液伺服闭环控制系统</span>，
            可实现力、位移、应变等多种控制模式，具有精度高、响应快、稳定性好等特点。
          </p>
        </section>

        {/* 试验机示意图 */}
        <section>
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs">2</span>
            系统组成示意图
          </h4>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            {/* SVG 试验机示意图 - 重新设计 */}
            <svg viewBox="0 0 600 400" className="w-full max-w-2xl mx-auto" style={{ maxHeight: '400px' }}>
              <defs>
                {/* 渐变定义 */}
                <linearGradient id="steelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#64748b"/>
                  <stop offset="100%" stopColor="#475569"/>
                </linearGradient>
                <linearGradient id="hydraulicGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#1d4ed8"/>
                </linearGradient>
                <linearGradient id="specimenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24"/>
                  <stop offset="100%" stopColor="#d97706"/>
                </linearGradient>
                {/* 阴影 */}
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                </filter>
              </defs>
              
              {/* 背景 */}
              <rect x="0" y="0" width="600" height="400" fill="#0f172a" rx="12"/>
              
              {/* ===== 试验机主体 ===== */}
              {/* 底座 */}
              <rect x="180" y="340" width="240" height="25" fill="#334155" rx="4" filter="url(#shadow)"/>
              <rect x="190" y="345" width="220" height="15" fill="#1e293b" rx="2"/>
              
              {/* 左立柱 */}
              <rect x="195" y="80" width="20" height="260" fill="url(#steelGrad)" rx="3"/>
              <rect x="198" y="85" width="6" height="250" fill="#94a3b8" opacity="0.3"/>
              
              {/* 右立柱 */}
              <rect x="385" y="80" width="20" height="260" fill="url(#steelGrad)" rx="3"/>
              <rect x="396" y="85" width="6" height="250" fill="#94a3b8" opacity="0.3"/>
              
              {/* 顶梁 */}
              <rect x="190" y="65" width="220" height="25" fill="url(#steelGrad)" rx="4" filter="url(#shadow)"/>
              
              {/* ===== 液压系统 ===== */}
              {/* 液压缸外壳 */}
              <rect x="260" y="95" width="80" height="50" fill="url(#hydraulicGrad)" rx="6" filter="url(#shadow)"/>
              <rect x="270" y="100" width="60" height="10" fill="#60a5fa" rx="2"/>
              <text x="300" y="135" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">液压缸</text>
              
              {/* 活塞杆 */}
              <rect x="288" y="145" width="24" height="35" fill="#60a5fa" rx="2"/>
              <rect x="292" y="150" width="16" height="25" fill="#93c5fd" rx="1"/>
              
              {/* ===== 上压板组件 ===== */}
              <rect x="235" y="180" width="130" height="18" fill="url(#steelGrad)" rx="3" filter="url(#shadow)"/>
              <text x="300" y="193" textAnchor="middle" fill="white" fontSize="9">上压板</text>
              
              {/* 荷载传感器 */}
              <rect x="270" y="200" width="60" height="22" fill="#22c55e" rx="4" filter="url(#shadow)"/>
              <text x="300" y="215" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">Load Cell</text>
              
              {/* ===== 试件 ===== */}
              <rect x="265" y="228" width="70" height="70" fill="url(#specimenGrad)" rx="4" filter="url(#shadow)"/>
              <text x="300" y="270" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">试件</text>
              
              {/* ===== 下压板 ===== */}
              <rect x="235" y="305" width="130" height="18" fill="url(#steelGrad)" rx="3" filter="url(#shadow)"/>
              <text x="300" y="318" textAnchor="middle" fill="white" fontSize="9">下压板</text>
              
              {/* ===== LVDT 位移传感器 ===== */}
              <rect x="420" y="220" width="22" height="80" fill="#a855f7" rx="4" filter="url(#shadow)"/>
              <rect x="424" y="230" width="14" height="60" fill="#c084fc" rx="2"/>
              <text x="431" y="320" textAnchor="middle" fill="#a855f7" fontSize="9" fontWeight="bold">LVDT</text>
              {/* LVDT 连接臂 */}
              <line x1="405" y1="260" x2="420" y2="260" stroke="#a855f7" strokeWidth="3"/>
              <circle cx="408" cy="260" r="4" fill="#a855f7"/>
              
              {/* ===== 控制器 ===== */}
              <rect x="40" y="140" width="100" height="130" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" rx="8" filter="url(#shadow)"/>
              {/* 控制器标题 */}
              <rect x="50" y="150" width="80" height="20" fill="#3b82f6" rx="3"/>
              <text x="90" y="164" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">控制器</text>
              {/* 显示屏 */}
              <rect x="55" y="180" width="70" height="35" fill="#0f172a" rx="4" stroke="#334155"/>
              <text x="90" y="195" textAnchor="middle" fill="#22c55e" fontSize="8">PID Control</text>
              <text x="90" y="208" textAnchor="middle" fill="#60a5fa" fontSize="7">0.00 kN</text>
              {/* 指示灯 */}
              <circle cx="60" cy="235" r="6" fill="#22c55e"/>
              <circle cx="78" cy="235" r="6" fill="#fbbf24"/>
              <circle cx="96" cy="235" r="6" fill="#64748b"/>
              <text x="60" y="252" fill="#64748b" fontSize="7">RUN</text>
              <text x="78" y="252" fill="#64748b" fontSize="7">HOLD</text>
              <text x="96" y="252" fill="#64748b" fontSize="7">STOP</text>
              
              {/* ===== 连接线缆 ===== */}
              {/* 控制器到液压缸 */}
              <path d="M140 180 Q170 180 170 140 Q170 100 200 100 L260 115" 
                    stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="6,3"/>
              {/* 荷载传感器到控制器 */}
              <path d="M270 211 L230 211 Q160 211 160 200 L140 200" 
                    stroke="#22c55e" strokeWidth="2" fill="none" strokeDasharray="6,3"/>
              {/* LVDT到控制器 */}
              <path d="M420 260 Q450 260 450 320 Q450 360 400 360 L160 360 Q140 360 140 340 L140 270" 
                    stroke="#a855f7" strokeWidth="2" fill="none" strokeDasharray="6,3"/>
              
              {/* ===== 标注箭头 ===== */}
              {/* 加载方向 */}
              <path d="M300 160 L300 175" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)"/>
              <polygon points="295,172 300,180 305,172" fill="#ef4444"/>
              <text x="320" y="170" fill="#ef4444" fontSize="8">加载方向</text>
              
              {/* ===== 尺寸标注 ===== */}
              <text x="530" y="180" fill="#64748b" fontSize="9">量程: 3000kN</text>
              <text x="530" y="195" fill="#64748b" fontSize="9">精度: ±0.5%</text>
              <text x="530" y="210" fill="#64748b" fontSize="9">速率: 0.1~50mm/s</text>
            </svg>
            
            {/* 图例 */}
            <div className="flex flex-wrap justify-center gap-6 mt-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-b from-blue-500 to-blue-700"></div>
                <span className="text-slate-300">液压加载系统</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-slate-300">荷载传感器</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-500"></div>
                <span className="text-slate-300">位移传感器 (LVDT)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gradient-to-b from-amber-400 to-amber-600"></div>
                <span className="text-slate-300">试件</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-500"></div>
                <span className="text-slate-300">机械框架</span>
              </div>
            </div>
          </div>
        </section>

        {/* 主要组成 */}
        <section>
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-xs">3</span>
            主要组成
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {/* 加载系统 */}
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 rounded-xl p-4 border border-blue-700/30 hover:border-blue-500/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div>
                  <div className="text-blue-400 font-bold text-sm">加载系统</div>
                  <div className="text-[10px] text-slate-500">Loading System</div>
                </div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  液压缸/作动器 - 产生加载力
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  液压泵站 - 提供液压动力
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  伺服阀 - 精确控制流量
                </li>
              </ul>
            </div>
            
            {/* 测量系统 */}
            <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-xl p-4 border border-green-700/30 hover:border-green-500/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-600/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-green-400 font-bold text-sm">测量系统</div>
                  <div className="text-[10px] text-slate-500">Measurement System</div>
                </div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  荷载传感器 - 测量力值
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  LVDT - 测量位移
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  引伸计 - 测量应变
                </li>
              </ul>
            </div>
            
            {/* 控制系统 */}
            <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/20 rounded-xl p-4 border border-orange-700/30 hover:border-orange-500/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-600/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-orange-400 font-bold text-sm">控制系统</div>
                  <div className="text-[10px] text-slate-500">Control System</div>
                </div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  PID 控制器 - 闭环控制
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  数据采集器 - 信号处理
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  安全联锁 - 保护机制
                </li>
              </ul>
            </div>
            
            {/* 机械框架 */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-xl p-4 border border-purple-700/30 hover:border-purple-500/50 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <div className="text-purple-400 font-bold text-sm">机械框架</div>
                  <div className="text-[10px] text-slate-500">Mechanical Frame</div>
                </div>
              </div>
              <ul className="text-xs text-slate-400 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  加载框架 - 承受反力
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  上下压板 - 传递荷载
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  球铰支座 - 自动对中
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 控制模式 */}
        <section>
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-xs">4</span>
            控制模式
          </h4>
          <div className="space-y-3">
            {/* 力控制 */}
            <div className="bg-slate-800/50 rounded-xl p-4 border-l-4 border-blue-500 hover:bg-slate-800/70 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">力控制</span>
                    <span className="text-[10px] text-slate-500">Force Control</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">以荷载为控制目标，保持恒定加载速率</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-blue-400">适用场景</div>
                  <div className="text-[10px] text-slate-500">强度测定、弹性阶段</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-[10px]">精确控制应力</span>
                <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px]">峰后无法控制</span>
              </div>
            </div>
            
            {/* 位移控制 */}
            <div className="bg-slate-800/50 rounded-xl p-4 border-l-4 border-green-500 hover:bg-slate-800/70 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">位移控制</span>
                    <span className="text-[10px] text-slate-500">Displacement Control</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">以位移为控制目标，可获取完整曲线</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-green-400">适用场景</div>
                  <div className="text-[10px] text-slate-500">全曲线、软化段</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-[10px]">完整应力-应变曲线</span>
                <span className="px-2 py-0.5 bg-green-900/50 text-green-300 rounded text-[10px]">可控下降段</span>
              </div>
            </div>
            
            {/* 程序控制 */}
            <div className="bg-slate-800/50 rounded-xl p-4 border-l-4 border-purple-500 hover:bg-slate-800/70 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">程序控制</span>
                    <span className="text-[10px] text-slate-500">Program Control</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">按预设程序自动加载，支持复杂波形</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-purple-400">适用场景</div>
                  <div className="text-[10px] text-slate-500">循环加载、疲劳试验</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[10px]">自动化试验</span>
                <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded text-[10px]">滞回曲线</span>
              </div>
            </div>
          </div>
        </section>

        {/* 安全注意事项 */}
        <section>
          <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs">5</span>
            安全注意事项
          </h4>
          <div className="bg-gradient-to-r from-red-900/30 to-orange-900/20 rounded-xl p-5 border border-red-700/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: '🚪', title: '安全门', desc: '试验前确认安全门已关闭' },
                { icon: '🎯', title: '对中放置', desc: '确保试件位于压板中心' },
                { icon: '⚙️', title: '保护限位', desc: '设置合理的力和位移限位' },
                { icon: '⛔', title: '危险区域', desc: '试验中禁止进入加载区' },
                { icon: '🔴', title: '急停按钮', desc: '异常情况立即按下急停' },
                { icon: '👁️', title: '实时监控', desc: '密切关注试验数据变化' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-900/50 rounded-lg p-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    ),
  },
];

export const TheoryPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState(theorySections[0].id);
  const currentSection = theorySections.find(s => s.id === activeSection)!;

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      <div>
        <h2 className="text-xl font-bold text-white">理论知识 Theory & Knowledge</h2>
        <p className="text-xs text-slate-500 mt-1">了解材料试验的基本原理和方法</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 overflow-auto">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <BookOpen size={14} />
            目录 Contents
          </h3>
          
          <div className="space-y-1">
            {theorySections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="font-medium text-sm">{section.title}</div>
                <div className="text-[10px] opacity-70">{section.titleEn}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-500 mb-3">参考资料</h4>
            <div className="space-y-2">
              <a href="https://www.astm.org" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400">
                <ExternalLink size={12} /> ASTM Standards
              </a>
              <a href="https://www.gb688.cn" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400">
                <ExternalLink size={12} /> 国家标准全文公开
              </a>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-slate-900/50 rounded-xl border border-slate-800 p-6 overflow-auto">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">{currentSection.title}</h3>
            <p className="text-xs text-slate-500 mb-6">{currentSection.titleEn}</p>
            <div className="text-sm text-slate-300 leading-relaxed">
              {currentSection.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
