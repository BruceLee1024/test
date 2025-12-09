/**
 * 网格生成模块
 * Mesh Generation Module
 */

import { Node, Element, Mesh, Material } from './types';

/**
 * 生成矩形试件网格
 * @param width 宽度 (mm)
 * @param height 高度 (mm)
 * @param nx x方向单元数
 * @param ny y方向单元数
 * @param material 材料属性
 */
export function generateRectangularMesh(
  width: number,
  height: number,
  nx: number,
  ny: number,
  material: Material
): Mesh {
  const nodes: Node[] = [];
  const elements: Element[] = [];
  
  const dx = width / nx;
  const dy = height / ny;
  
  // 生成节点
  let nodeId = 0;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      nodes.push({
        id: nodeId++,
        x: i * dx,
        y: j * dy,
      });
    }
  }
  
  // 生成四边形单元 (逆时针节点顺序)
  let elemId = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const n1 = j * (nx + 1) + i;         // 左下
      const n2 = j * (nx + 1) + i + 1;     // 右下
      const n3 = (j + 1) * (nx + 1) + i + 1; // 右上
      const n4 = (j + 1) * (nx + 1) + i;   // 左上
      
      elements.push({
        id: elemId++,
        nodes: [n1, n2, n3, n4],
        materialId: material.id,
      });
    }
  }
  
  return {
    nodes,
    elements,
    materials: [material],
  };
}

/**
 * 生成圆柱体试件网格 (2D轴对称简化为矩形)
 * @param diameter 直径 (mm)
 * @param height 高度 (mm)
 * @param nr 径向单元数
 * @param nz 轴向单元数
 * @param material 材料属性
 */
export function generateCylinderMesh(
  diameter: number,
  height: number,
  nr: number,
  nz: number,
  material: Material
): Mesh {
  // 对于轴对称问题，只需建模半径方向
  const radius = diameter / 2;
  return generateRectangularMesh(radius, height, nr, nz, material);
}

/**
 * 应用底部固定边界条件
 * @param mesh 网格
 * @param fixX 是否固定X方向（默认只固定中心点X，模拟对称约束）
 */
export function applyBottomFixedBC(mesh: Mesh, fixX: boolean = false): void {
  const minY = Math.min(...mesh.nodes.map(n => n.y));
  const bottomNodes = mesh.nodes.filter(n => Math.abs(n.y - minY) < 1e-6);
  
  // 找到底部中心节点
  const centerX = (Math.min(...bottomNodes.map(n => n.x)) + Math.max(...bottomNodes.map(n => n.x))) / 2;
  
  bottomNodes.forEach(node => {
    // Y 方向全部固定（底部支撑）
    node.fixedY = true;
    
    // X 方向：只固定中心点防止刚体位移，其他点自由（允许泊松膨胀）
    if (fixX) {
      node.fixedX = true; // 全部固定（模拟高摩擦）
    } else {
      node.fixedX = Math.abs(node.x - centerX) < 1e-6; // 只固定中心点
    }
  });
}

/**
 * 应用压缩试验边界条件（模拟真实压板摩擦）
 * 
 * 真实压缩试验中：
 * - 压板与试件之间有摩擦，限制端部横向变形
 * - 导致端部应力集中，中间区域应力较均匀
 * - 产生典型的"沙漏"形破坏模式
 */
export function applyCompressionBC(mesh: Mesh): void {
  const minY = Math.min(...mesh.nodes.map(n => n.y));
  const maxY = Math.max(...mesh.nodes.map(n => n.y));
  const bottomNodes = mesh.nodes.filter(n => Math.abs(n.y - minY) < 1e-6);
  const topNodes = mesh.nodes.filter(n => Math.abs(n.y - maxY) < 1e-6);
  
  // 底部约束：模拟高摩擦压板
  // X和Y方向都固定（完全约束横向变形）
  bottomNodes.forEach(node => {
    node.fixedX = true;
    node.fixedY = true;
  });
  
  // 顶部约束：模拟高摩擦压板
  // X方向固定（限制横向变形），Y方向自由（施加载荷）
  topNodes.forEach(node => {
    node.fixedX = true;
    node.fixedY = false;
  });
}

/**
 * 应用顶部 Y 方向固定（模拟压板）
 * @param mesh 网格
 */
export function applyTopYFixedBC(mesh: Mesh): void {
  const maxY = Math.max(...mesh.nodes.map(n => n.y));
  mesh.nodes.forEach(node => {
    if (Math.abs(node.y - maxY) < 1e-6) {
      node.fixedX = false; // X方向自由（允许泊松效应）
      // Y方向通过位移控制
    }
  });
}

/**
 * 获取顶部节点ID列表
 */
export function getTopNodeIds(mesh: Mesh): number[] {
  const maxY = Math.max(...mesh.nodes.map(n => n.y));
  return mesh.nodes
    .filter(n => Math.abs(n.y - maxY) < 1e-6)
    .map(n => n.id);
}

/**
 * 获取底部节点ID列表
 */
export function getBottomNodeIds(mesh: Mesh): number[] {
  const minY = Math.min(...mesh.nodes.map(n => n.y));
  return mesh.nodes
    .filter(n => Math.abs(n.y - minY) < 1e-6)
    .map(n => n.id);
}

/**
 * 计算网格统计信息
 */
export function getMeshStats(mesh: Mesh) {
  const xs = mesh.nodes.map(n => n.x);
  const ys = mesh.nodes.map(n => n.y);
  
  return {
    nodeCount: mesh.nodes.length,
    elementCount: mesh.elements.length,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * 预定义混凝土材料
 */
export function createConcreteMaterial(grade: number): Material {
  // 根据混凝土等级估算弹性模量 (GB 50010)
  const E = 4730 * Math.sqrt(grade) * 1000; // MPa -> Pa -> MPa
  
  return {
    id: 1,
    name: `C${grade} 混凝土`,
    E: E / 1000, // 转换为 GPa 再转回 MPa (保持 MPa)
    nu: 0.2,     // 混凝土泊松比
    rho: 2400,   // 密度 kg/m³
    fc: grade,   // 抗压强度 MPa
    ft: grade * 0.1, // 抗拉强度约为抗压的 1/10
  };
}

/**
 * 预定义钢材材料
 */
export function createSteelMaterial(grade: number = 235): Material {
  return {
    id: 2,
    name: `Q${grade} 钢材`,
    E: 206000,   // 弹性模量 MPa
    nu: 0.3,     // 泊松比
    rho: 7850,   // 密度 kg/m³
    fc: grade,   // 屈服强度 MPa
    ft: grade,
  };
}
