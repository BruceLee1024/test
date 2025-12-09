/**
 * 2D 有限元求解器
 * 2D Finite Element Solver
 * 
 * 使用 4 节点等参四边形单元 (Q4)
 * 平面应力/平面应变分析
 */

import { 
  Mesh, Node, Element, Material, 
  NodalLoad, DisplacementBC, 
  FEMResult, NodeResult, ElementResult,
  AnalysisType 
} from './types';

// 高斯积分点 (2x2)
const GAUSS_POINTS = [
  { xi: -1/Math.sqrt(3), eta: -1/Math.sqrt(3), w: 1 },
  { xi:  1/Math.sqrt(3), eta: -1/Math.sqrt(3), w: 1 },
  { xi:  1/Math.sqrt(3), eta:  1/Math.sqrt(3), w: 1 },
  { xi: -1/Math.sqrt(3), eta:  1/Math.sqrt(3), w: 1 },
];

/**
 * 形函数 (4节点四边形)
 */
function shapeFunctions(xi: number, eta: number): number[] {
  return [
    0.25 * (1 - xi) * (1 - eta),  // N1
    0.25 * (1 + xi) * (1 - eta),  // N2
    0.25 * (1 + xi) * (1 + eta),  // N3
    0.25 * (1 - xi) * (1 + eta),  // N4
  ];
}

/**
 * 形函数对自然坐标的导数
 */
function shapeFunctionDerivatives(xi: number, eta: number): { dNdXi: number[], dNdEta: number[] } {
  return {
    dNdXi: [
      -0.25 * (1 - eta),
       0.25 * (1 - eta),
       0.25 * (1 + eta),
      -0.25 * (1 + eta),
    ],
    dNdEta: [
      -0.25 * (1 - xi),
      -0.25 * (1 + xi),
       0.25 * (1 + xi),
       0.25 * (1 - xi),
    ],
  };
}

/**
 * 计算雅可比矩阵
 */
function computeJacobian(
  dNdXi: number[], 
  dNdEta: number[], 
  nodeCoords: { x: number, y: number }[]
): { J: number[][], detJ: number, invJ: number[][] } {
  const J = [
    [0, 0],
    [0, 0],
  ];
  
  for (let i = 0; i < 4; i++) {
    J[0][0] += dNdXi[i] * nodeCoords[i].x;
    J[0][1] += dNdXi[i] * nodeCoords[i].y;
    J[1][0] += dNdEta[i] * nodeCoords[i].x;
    J[1][1] += dNdEta[i] * nodeCoords[i].y;
  }
  
  const detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0];
  
  const invJ = [
    [ J[1][1] / detJ, -J[0][1] / detJ],
    [-J[1][0] / detJ,  J[0][0] / detJ],
  ];
  
  return { J, detJ, invJ };
}

/**
 * 计算 B 矩阵 (应变-位移矩阵)
 */
function computeBMatrix(
  dNdXi: number[], 
  dNdEta: number[], 
  invJ: number[][]
): number[][] {
  const B: number[][] = Array(3).fill(null).map(() => Array(8).fill(0));
  
  for (let i = 0; i < 4; i++) {
    const dNdx = invJ[0][0] * dNdXi[i] + invJ[0][1] * dNdEta[i];
    const dNdy = invJ[1][0] * dNdXi[i] + invJ[1][1] * dNdEta[i];
    
    B[0][2*i]     = dNdx;  // ε_x = du/dx
    B[1][2*i + 1] = dNdy;  // ε_y = dv/dy
    B[2][2*i]     = dNdy;  // γ_xy = du/dy + dv/dx
    B[2][2*i + 1] = dNdx;
  }
  
  return B;
}

/**
 * Hognestad 抛物线本构 - 计算应力
 */
function hognestadStress(strain: number, fc: number, epsilon0: number): number {
  if (strain <= 0) return 0;
  if (strain <= epsilon0) {
    // 上升段: σ = fc * [2(ε/ε0) - (ε/ε0)²]
    const ratio = strain / epsilon0;
    return fc * (2 * ratio - ratio * ratio);
  }
  // 下降段简化处理
  return fc * Math.max(0.2, 1 - 0.5 * (strain - epsilon0) / epsilon0);
}

/**
 * GB 50010-2010 中国规范本构 - 计算应力
 * 上升段: σ = fc × [αa·x + (3-2αa)x² + (αa-2)x³], x = ε/ε₀
 * 下降段: σ = fc / [αd·(x-1)² + x]
 */
function gb50010Stress(strain: number, fc: number, epsilon0: number): number {
  if (strain <= 0) return 0;
  
  // 计算参数
  const alphaA = Math.max(0.7, Math.min(2.4, 2.4 - 0.0125 * fc));
  const alphaD = Math.max(0.1, 0.157 * Math.pow(fc, 0.785) - 0.905);
  
  const x = strain / epsilon0;
  
  if (x <= 1) {
    // 上升段
    return fc * (alphaA * x + (3 - 2 * alphaA) * x * x + (alphaA - 2) * x * x * x);
  } else {
    // 下降段
    return fc / (alphaD * (x - 1) * (x - 1) + x);
  }
}

/**
 * 损伤本构 - 计算应力和损伤变量
 * σ = (1 - d) × E × ε
 */
function damageStress(strain: number, fc: number, epsilon0: number, E: number): { stress: number; damage: number } {
  if (strain <= 0) return { stress: 0, damage: 0 };
  
  // 使用 Hognestad 作为包络线
  const envelopeStress = hognestadStress(Math.min(strain, epsilon0), fc, epsilon0);
  
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

/**
 * Mander 约束混凝土本构 - 计算应力
 * σ = fcc × xr / (r - 1 + x^r)
 * x = ε/εcc, r = Ec/(Ec - Esec)
 */
function manderStress(strain: number, fc: number, epsilon0: number, E: number): number {
  if (strain <= 0) return 0;
  
  // 约束效应系数（简化为无约束情况）
  const fcc = fc;
  const epsilonCC = epsilon0;
  
  const Esec = fcc / epsilonCC;
  const r = E / (E - Esec);
  const x = strain / epsilonCC;
  
  const stress = fcc * x * r / (r - 1 + Math.pow(x, r));
  return Math.max(0, stress);
}

/**
 * Eurocode 2 本构 - 计算应力
 * σ = fcm × [kη - η²] / [1 + (k-2)η]
 * η = ε/εc1, k = 1.05 × Ecm × εc1 / fcm
 */
function eurocodeStress(strain: number, fc: number, epsilon0: number, E: number): number {
  if (strain <= 0) return 0;
  
  const fcm = fc;
  const epsilonC1 = epsilon0;
  const Ecm = E;
  
  const k = 1.05 * Ecm * epsilonC1 / fcm;
  const eta = strain / epsilonC1;
  
  if (eta <= 1) {
    // 上升段
    const stress = fcm * (k * eta - eta * eta) / (1 + (k - 2) * eta);
    return Math.max(0, stress);
  } else {
    // 下降段（简化处理）
    const stress = fcm * Math.max(0.2, 1 - 0.3 * (eta - 1));
    return stress;
  }
}

/**
 * 通用本构应力计算
 */
function computeConstitutiveStress(
  material: Material,
  strain: number
): number {
  const { fc, epsilon0, E, constitutive } = material;
  
  if (!fc || !epsilon0) {
    return E * strain; // 线弹性
  }
  
  switch (constitutive) {
    case 'hognestad':
      return hognestadStress(strain, fc, epsilon0);
    case 'gb50010':
      return gb50010Stress(strain, fc, epsilon0);
    case 'damage':
      return damageStress(strain, fc, epsilon0, E).stress;
    case 'mander':
      return manderStress(strain, fc, epsilon0, E);
    case 'eurocode':
      return eurocodeStress(strain, fc, epsilon0, E);
    default:
      return E * strain; // 线弹性
  }
}

/**
 * 计算切线模量 (非线性本构)
 */
function computeTangentModulus(
  material: Material, 
  strain: number
): number {
  const { E, fc, epsilon0, constitutive } = material;
  
  // 线弹性或无本构参数
  if (constitutive === 'linear' || !fc || !epsilon0) {
    return E;
  }
  
  // 座浆阶段用初始模量
  if (strain <= 0.0001) return E;
  
  // 数值微分计算切线模量
  const delta = 0.00001;
  const stress1 = computeConstitutiveStress(material, strain);
  const stress2 = computeConstitutiveStress(material, strain + delta);
  const Et = (stress2 - stress1) / delta;
  
  // 确保切线模量在合理范围内
  return Math.max(Et, E * 0.01);
}

/**
 * 计算弹性矩阵 D (支持非线性本构)
 */
function computeDMatrix(
  material: Material, 
  analysisType: AnalysisType,
  strain?: number
): number[][] {
  // 如果提供了应变，使用切线模量
  const E = strain !== undefined 
    ? computeTangentModulus(material, Math.abs(strain))
    : material.E;
  const nu = material.nu;
  
  if (analysisType === 'plane_stress') {
    const factor = E / (1 - nu * nu);
    return [
      [factor,        factor * nu,   0],
      [factor * nu,   factor,        0],
      [0,             0,             factor * (1 - nu) / 2],
    ];
  } else {
    // plane_strain
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    return [
      [factor * (1 - nu),  factor * nu,        0],
      [factor * nu,        factor * (1 - nu),  0],
      [0,                  0,                  factor * (1 - 2 * nu) / 2],
    ];
  }
}

/**
 * 矩阵乘法 A * B
 */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: number[][] = Array(m).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/**
 * 矩阵转置
 */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const AT: number[][] = Array(n).fill(null).map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      AT[j][i] = A[i][j];
    }
  }
  return AT;
}

/**
 * 计算单元刚度矩阵 (8x8)
 */
function computeElementStiffness(
  element: Element,
  nodes: Node[],
  material: Material,
  analysisType: AnalysisType,
  thickness: number = 1
): number[][] {
  const Ke: number[][] = Array(8).fill(null).map(() => Array(8).fill(0));
  
  // 获取单元节点坐标
  const nodeCoords = element.nodes.map(nid => {
    const node = nodes.find(n => n.id === nid)!;
    return { x: node.x, y: node.y };
  });
  
  // 弹性矩阵
  const D = computeDMatrix(material, analysisType);
  
  // 高斯积分
  for (const gp of GAUSS_POINTS) {
    const { dNdXi, dNdEta } = shapeFunctionDerivatives(gp.xi, gp.eta);
    const { detJ, invJ } = computeJacobian(dNdXi, dNdEta, nodeCoords);
    const B = computeBMatrix(dNdXi, dNdEta, invJ);
    
    // Ke += B^T * D * B * detJ * w * thickness
    const BT = transpose(B);
    const DB = matMul(D, B);
    const BTD_B = matMul(BT, DB);
    
    const factor = detJ * gp.w * thickness;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        Ke[i][j] += BTD_B[i][j] * factor;
      }
    }
  }
  
  return Ke;
}

/**
 * 组装全局刚度矩阵
 */
function assembleGlobalStiffness(
  mesh: Mesh,
  analysisType: AnalysisType,
  thickness: number = 1
): number[][] {
  const ndof = mesh.nodes.length * 2;
  const K: number[][] = Array(ndof).fill(null).map(() => Array(ndof).fill(0));
  
  for (const element of mesh.elements) {
    const material = mesh.materials.find(m => m.id === element.materialId)!;
    const Ke = computeElementStiffness(element, mesh.nodes, material, analysisType, thickness);
    
    // 组装到全局矩阵
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const gi = element.nodes[i] * 2;
        const gj = element.nodes[j] * 2;
        
        K[gi][gj]         += Ke[2*i][2*j];
        K[gi][gj + 1]     += Ke[2*i][2*j + 1];
        K[gi + 1][gj]     += Ke[2*i + 1][2*j];
        K[gi + 1][gj + 1] += Ke[2*i + 1][2*j + 1];
      }
    }
  }
  
  return K;
}

/**
 * 应用边界条件 (罚函数法)
 */
function applyBoundaryConditions(
  K: number[][],
  F: number[],
  mesh: Mesh,
  displacementBCs: DisplacementBC[]
): void {
  const penalty = 1e20;
  
  // 固定边界条件
  for (const node of mesh.nodes) {
    if (node.fixedX) {
      const dof = node.id * 2;
      K[dof][dof] += penalty;
      F[dof] = 0;
    }
    if (node.fixedY) {
      const dof = node.id * 2 + 1;
      K[dof][dof] += penalty;
      F[dof] = 0;
    }
  }
  
  // 位移边界条件
  for (const bc of displacementBCs) {
    if (bc.ux !== undefined) {
      const dof = bc.nodeId * 2;
      K[dof][dof] += penalty;
      F[dof] = penalty * bc.ux;
    }
    if (bc.uy !== undefined) {
      const dof = bc.nodeId * 2 + 1;
      K[dof][dof] += penalty;
      F[dof] = penalty * bc.uy;
    }
  }
}

/**
 * 组装载荷向量
 */
function assembleLoadVector(
  mesh: Mesh,
  nodalLoads: NodalLoad[]
): number[] {
  const ndof = mesh.nodes.length * 2;
  const F: number[] = Array(ndof).fill(0);
  
  for (const load of nodalLoads) {
    if (load.fx !== undefined) {
      F[load.nodeId * 2] += load.fx;
    }
    if (load.fy !== undefined) {
      F[load.nodeId * 2 + 1] += load.fy;
    }
  }
  
  return F;
}

/**
 * 高斯消元法求解线性方程组 Kx = F
 */
function solveLinearSystem(K: number[][], F: number[]): number[] {
  const n = F.length;
  const A = K.map(row => [...row]);
  const b = [...F];
  
  // 前向消元
  for (let k = 0; k < n - 1; k++) {
    // 选主元
    let maxVal = Math.abs(A[k][k]);
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A[i][k]) > maxVal) {
        maxVal = Math.abs(A[i][k]);
        maxRow = i;
      }
    }
    
    // 交换行
    if (maxRow !== k) {
      [A[k], A[maxRow]] = [A[maxRow], A[k]];
      [b[k], b[maxRow]] = [b[maxRow], b[k]];
    }
    
    // 消元
    for (let i = k + 1; i < n; i++) {
      const factor = A[i][k] / A[k][k];
      for (let j = k; j < n; j++) {
        A[i][j] -= factor * A[k][j];
      }
      b[i] -= factor * b[k];
    }
  }
  
  // 回代
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    x[i] = sum / A[i][i];
  }
  
  return x;
}

/**
 * 计算单元应力应变
 */
function computeElementStressStrain(
  element: Element,
  nodes: Node[],
  displacements: number[],
  material: Material,
  analysisType: AnalysisType
): ElementResult {
  // 获取单元节点坐标和位移
  const nodeCoords = element.nodes.map(nid => {
    const node = nodes.find(n => n.id === nid)!;
    return { x: node.x, y: node.y };
  });
  
  const ue: number[] = [];
  for (const nid of element.nodes) {
    ue.push(displacements[nid * 2]);
    ue.push(displacements[nid * 2 + 1]);
  }
  
  // 在单元中心计算应力 (xi=0, eta=0)
  const { dNdXi, dNdEta } = shapeFunctionDerivatives(0, 0);
  const { invJ } = computeJacobian(dNdXi, dNdEta, nodeCoords);
  const B = computeBMatrix(dNdXi, dNdEta, invJ);
  
  // 应变 ε = B * u
  const strain = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 8; j++) {
      strain[i] += B[i][j] * ue[j];
    }
  }
  
  // 根据本构模型计算应力
  let sigmaX: number, sigmaY: number, tauXY: number;
  
  // 压缩应变为负值
  const epsilonY = strain[1]; // Y方向应变（压缩为负）
  const epsilonX = strain[0]; // X方向应变（泊松膨胀为正）
  
  if (material.constitutive === 'hognestad' && material.fc && material.epsilon0) {
    // 非线性本构：使用 Hognestad 模型
    // 压缩应变取绝对值用于本构计算
    const compressiveStrain = Math.abs(epsilonY);
    
    // Y 方向应力（压缩为负）
    const stressMagnitude = computeConstitutiveStress(material, compressiveStrain);
    sigmaY = epsilonY < 0 ? -stressMagnitude : stressMagnitude;
    
    // 计算当前切线模量
    const Et = computeTangentModulus(material, compressiveStrain);
    
    // X 方向应力（考虑泊松效应）
    // 对于平面应力：σx = E/(1-ν²) * (εx + ν*εy)
    // 简化处理：使用切线模量
    const nu = material.nu;
    sigmaX = Et / (1 - nu * nu) * (epsilonX + nu * epsilonY);
    
    // 剪应力
    const G = Et / (2 * (1 + nu));
    tauXY = G * strain[2];
  } else {
    // 线弹性本构
    const D = computeDMatrix(material, analysisType);
    const stress = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        stress[i] += D[i][j] * strain[j];
      }
    }
    sigmaX = stress[0];
    sigmaY = stress[1];
    tauXY = stress[2];
  }
  
  const sigmaAvg = (sigmaX + sigmaY) / 2;
  const R = Math.sqrt(Math.pow((sigmaX - sigmaY) / 2, 2) + tauXY * tauXY);
  const sigma1 = sigmaAvg + R;
  const sigma2 = sigmaAvg - R;
  
  // von Mises 等效应力
  const vonMises = Math.sqrt(
    sigmaX * sigmaX + sigmaY * sigmaY - sigmaX * sigmaY + 3 * tauXY * tauXY
  );
  
  return {
    elementId: element.id,
    sigmaX,
    sigmaY,
    tauXY,
    sigma1,
    sigma2,
    vonMises,
    epsilonX: strain[0],
    epsilonY: strain[1],
    gammaXY: strain[2],
  };
}

/**
 * 主求解函数
 */
export function solve(
  mesh: Mesh,
  nodalLoads: NodalLoad[],
  displacementBCs: DisplacementBC[] = [],
  analysisType: AnalysisType = 'plane_stress',
  thickness: number = 1
): FEMResult {
  console.log('FEM Solver: Starting analysis...');
  console.log(`  Nodes: ${mesh.nodes.length}, Elements: ${mesh.elements.length}`);
  
  // 1. 组装全局刚度矩阵
  const K = assembleGlobalStiffness(mesh, analysisType, thickness);
  
  // 2. 组装载荷向量
  const F = assembleLoadVector(mesh, nodalLoads);
  
  // 3. 应用边界条件
  applyBoundaryConditions(K, F, mesh, displacementBCs);
  
  // 4. 求解位移
  const U = solveLinearSystem(K, F);
  
  // 5. 提取节点结果
  const nodeResults: NodeResult[] = mesh.nodes.map(node => ({
    nodeId: node.id,
    ux: U[node.id * 2],
    uy: U[node.id * 2 + 1],
  }));
  
  // 6. 计算单元应力应变
  const elementResults: ElementResult[] = mesh.elements.map(element => {
    const material = mesh.materials.find(m => m.id === element.materialId)!;
    return computeElementStressStrain(element, mesh.nodes, U, material, analysisType);
  });
  
  // 7. 统计结果
  const maxDisplacement = Math.max(
    ...nodeResults.map(n => Math.sqrt(n.ux * n.ux + n.uy * n.uy))
  );
  const maxStress = Math.max(
    ...elementResults.map(e => Math.max(Math.abs(e.sigmaX), Math.abs(e.sigmaY)))
  );
  const maxVonMises = Math.max(...elementResults.map(e => e.vonMises));
  
  console.log('FEM Solver: Analysis complete');
  console.log(`  Max displacement: ${maxDisplacement.toFixed(6)} mm`);
  console.log(`  Max stress: ${maxStress.toFixed(2)} MPa`);
  console.log(`  Max von Mises: ${maxVonMises.toFixed(2)} MPa`);
  
  return {
    nodes: nodeResults,
    elements: elementResults,
    maxDisplacement,
    maxStress,
    maxVonMises,
    converged: true,
  };
}

/**
 * 快速压缩试验模拟
 */
export function simulateCompression(
  width: number,
  height: number,
  nx: number,
  ny: number,
  material: Material,
  appliedStress: number, // MPa (负值表示压缩)
  analysisType: AnalysisType = 'plane_stress'
): FEMResult {
  // 导入网格生成函数
  const { generateRectangularMesh, applyBottomFixedBC, getTopNodeIds } = require('./mesh');
  
  // 生成网格
  const mesh = generateRectangularMesh(width, height, nx, ny, material);
  
  // 应用底部固定边界
  applyBottomFixedBC(mesh);
  
  // 在顶部施加均布压力 (转换为节点力)
  const topNodes = getTopNodeIds(mesh);
  const dx = width / nx;
  const forcePerNode = appliedStress * dx * 1; // 假设厚度为1
  
  const nodalLoads: NodalLoad[] = topNodes.map(nodeId => ({
    nodeId,
    fy: forcePerNode, // 负值 = 向下压
  }));
  
  // 边缘节点力减半
  if (nodalLoads.length > 0) {
    nodalLoads[0].fy! /= 2;
    nodalLoads[nodalLoads.length - 1].fy! /= 2;
  }
  
  return solve(mesh, nodalLoads, [], analysisType);
}
