/**
 * 3D 有限元求解器
 * 8节点六面体单元 (Hex8 / Brick Element)
 * 
 * 用于混凝土试块压缩试验的实时应力分析
 */

// 3D 节点
export interface Node3D {
  id: number;
  x: number;
  y: number;
  z: number;
  fixedX?: boolean;
  fixedY?: boolean;
  fixedZ?: boolean;
}

// 3D 六面体单元 (8节点)
export interface Element3D {
  id: number;
  nodes: number[]; // 8个节点ID
}

// 3D 网格
export interface Mesh3D {
  nodes: Node3D[];
  elements: Element3D[];
  E: number;      // 弹性模量 MPa
  nu: number;     // 泊松比
}

// 节点结果
export interface NodeResult3D {
  nodeId: number;
  ux: number;
  uy: number;
  uz: number;
}

// 单元结果
export interface ElementResult3D {
  elementId: number;
  // 应力分量
  sigmaX: number;
  sigmaY: number;
  sigmaZ: number;
  tauXY: number;
  tauYZ: number;
  tauXZ: number;
  // 主应力
  sigma1: number;
  sigma2: number;
  sigma3: number;
  // 等效应力
  vonMises: number;
  // 中心点坐标
  cx: number;
  cy: number;
  cz: number;
}

// 完整结果
export interface FEMResult3D {
  nodes: NodeResult3D[];
  elements: ElementResult3D[];
  maxDisplacement: number;
  maxVonMises: number;
}

// 高斯积分点 (2x2x2)
const GP = 1 / Math.sqrt(3);
const GAUSS_POINTS_3D = [
  { xi: -GP, eta: -GP, zeta: -GP, w: 1 },
  { xi:  GP, eta: -GP, zeta: -GP, w: 1 },
  { xi:  GP, eta:  GP, zeta: -GP, w: 1 },
  { xi: -GP, eta:  GP, zeta: -GP, w: 1 },
  { xi: -GP, eta: -GP, zeta:  GP, w: 1 },
  { xi:  GP, eta: -GP, zeta:  GP, w: 1 },
  { xi:  GP, eta:  GP, zeta:  GP, w: 1 },
  { xi: -GP, eta:  GP, zeta:  GP, w: 1 },
];

/**
 * 8节点六面体形函数
 */
function shapeFunctions3D(xi: number, eta: number, zeta: number): number[] {
  return [
    0.125 * (1 - xi) * (1 - eta) * (1 - zeta),
    0.125 * (1 + xi) * (1 - eta) * (1 - zeta),
    0.125 * (1 + xi) * (1 + eta) * (1 - zeta),
    0.125 * (1 - xi) * (1 + eta) * (1 - zeta),
    0.125 * (1 - xi) * (1 - eta) * (1 + zeta),
    0.125 * (1 + xi) * (1 - eta) * (1 + zeta),
    0.125 * (1 + xi) * (1 + eta) * (1 + zeta),
    0.125 * (1 - xi) * (1 + eta) * (1 + zeta),
  ];
}

/**
 * 形函数导数
 */
function shapeFunctionDerivatives3D(xi: number, eta: number, zeta: number) {
  return {
    dNdXi: [
      -0.125 * (1 - eta) * (1 - zeta),
       0.125 * (1 - eta) * (1 - zeta),
       0.125 * (1 + eta) * (1 - zeta),
      -0.125 * (1 + eta) * (1 - zeta),
      -0.125 * (1 - eta) * (1 + zeta),
       0.125 * (1 - eta) * (1 + zeta),
       0.125 * (1 + eta) * (1 + zeta),
      -0.125 * (1 + eta) * (1 + zeta),
    ],
    dNdEta: [
      -0.125 * (1 - xi) * (1 - zeta),
      -0.125 * (1 + xi) * (1 - zeta),
       0.125 * (1 + xi) * (1 - zeta),
       0.125 * (1 - xi) * (1 - zeta),
      -0.125 * (1 - xi) * (1 + zeta),
      -0.125 * (1 + xi) * (1 + zeta),
       0.125 * (1 + xi) * (1 + zeta),
       0.125 * (1 - xi) * (1 + zeta),
    ],
    dNdZeta: [
      -0.125 * (1 - xi) * (1 - eta),
      -0.125 * (1 + xi) * (1 - eta),
      -0.125 * (1 + xi) * (1 + eta),
      -0.125 * (1 - xi) * (1 + eta),
       0.125 * (1 - xi) * (1 - eta),
       0.125 * (1 + xi) * (1 - eta),
       0.125 * (1 + xi) * (1 + eta),
       0.125 * (1 - xi) * (1 + eta),
    ],
  };
}

/**
 * 计算雅可比矩阵及其逆
 */
function computeJacobian3D(
  dNdXi: number[],
  dNdEta: number[],
  dNdZeta: number[],
  coords: { x: number; y: number; z: number }[]
) {
  const J = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let i = 0; i < 8; i++) {
    J[0][0] += dNdXi[i] * coords[i].x;
    J[0][1] += dNdXi[i] * coords[i].y;
    J[0][2] += dNdXi[i] * coords[i].z;
    J[1][0] += dNdEta[i] * coords[i].x;
    J[1][1] += dNdEta[i] * coords[i].y;
    J[1][2] += dNdEta[i] * coords[i].z;
    J[2][0] += dNdZeta[i] * coords[i].x;
    J[2][1] += dNdZeta[i] * coords[i].y;
    J[2][2] += dNdZeta[i] * coords[i].z;
  }

  // 行列式
  const detJ =
    J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) -
    J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) +
    J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);

  // 逆矩阵
  const invJ = [
    [
      (J[1][1] * J[2][2] - J[1][2] * J[2][1]) / detJ,
      (J[0][2] * J[2][1] - J[0][1] * J[2][2]) / detJ,
      (J[0][1] * J[1][2] - J[0][2] * J[1][1]) / detJ,
    ],
    [
      (J[1][2] * J[2][0] - J[1][0] * J[2][2]) / detJ,
      (J[0][0] * J[2][2] - J[0][2] * J[2][0]) / detJ,
      (J[0][2] * J[1][0] - J[0][0] * J[1][2]) / detJ,
    ],
    [
      (J[1][0] * J[2][1] - J[1][1] * J[2][0]) / detJ,
      (J[0][1] * J[2][0] - J[0][0] * J[2][1]) / detJ,
      (J[0][0] * J[1][1] - J[0][1] * J[1][0]) / detJ,
    ],
  ];

  return { J, detJ, invJ };
}

/**
 * 计算 B 矩阵 (6x24)
 */
function computeBMatrix3D(
  dNdXi: number[],
  dNdEta: number[],
  dNdZeta: number[],
  invJ: number[][]
): number[][] {
  const B: number[][] = Array(6).fill(null).map(() => Array(24).fill(0));

  for (let i = 0; i < 8; i++) {
    const dNdx = invJ[0][0] * dNdXi[i] + invJ[0][1] * dNdEta[i] + invJ[0][2] * dNdZeta[i];
    const dNdy = invJ[1][0] * dNdXi[i] + invJ[1][1] * dNdEta[i] + invJ[1][2] * dNdZeta[i];
    const dNdz = invJ[2][0] * dNdXi[i] + invJ[2][1] * dNdEta[i] + invJ[2][2] * dNdZeta[i];

    // εx = du/dx
    B[0][3 * i] = dNdx;
    // εy = dv/dy
    B[1][3 * i + 1] = dNdy;
    // εz = dw/dz
    B[2][3 * i + 2] = dNdz;
    // γxy = du/dy + dv/dx
    B[3][3 * i] = dNdy;
    B[3][3 * i + 1] = dNdx;
    // γyz = dv/dz + dw/dy
    B[4][3 * i + 1] = dNdz;
    B[4][3 * i + 2] = dNdy;
    // γxz = du/dz + dw/dx
    B[5][3 * i] = dNdz;
    B[5][3 * i + 2] = dNdx;
  }

  return B;
}

/**
 * 3D 弹性矩阵 D (6x6)
 */
function computeDMatrix3D(E: number, nu: number): number[][] {
  const factor = E / ((1 + nu) * (1 - 2 * nu));
  return [
    [factor * (1 - nu), factor * nu, factor * nu, 0, 0, 0],
    [factor * nu, factor * (1 - nu), factor * nu, 0, 0, 0],
    [factor * nu, factor * nu, factor * (1 - nu), 0, 0, 0],
    [0, 0, 0, factor * (1 - 2 * nu) / 2, 0, 0],
    [0, 0, 0, 0, factor * (1 - 2 * nu) / 2, 0],
    [0, 0, 0, 0, 0, factor * (1 - 2 * nu) / 2],
  ];
}

/**
 * 矩阵乘法
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
 * 计算单元刚度矩阵 (24x24)
 */
function computeElementStiffness3D(
  element: Element3D,
  nodes: Node3D[],
  E: number,
  nu: number
): number[][] {
  const Ke: number[][] = Array(24).fill(null).map(() => Array(24).fill(0));

  const coords = element.nodes.map((nid) => {
    const n = nodes.find((node) => node.id === nid)!;
    return { x: n.x, y: n.y, z: n.z };
  });

  const D = computeDMatrix3D(E, nu);

  for (const gp of GAUSS_POINTS_3D) {
    const { dNdXi, dNdEta, dNdZeta } = shapeFunctionDerivatives3D(gp.xi, gp.eta, gp.zeta);
    const { detJ, invJ } = computeJacobian3D(dNdXi, dNdEta, dNdZeta, coords);
    const B = computeBMatrix3D(dNdXi, dNdEta, dNdZeta, invJ);

    const BT = transpose(B);
    const DB = matMul(D, B);
    const BTDB = matMul(BT, DB);

    const factor = detJ * gp.w;
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 24; j++) {
        Ke[i][j] += BTDB[i][j] * factor;
      }
    }
  }

  return Ke;
}

/**
 * 生成立方体网格
 */
export function generateCubeMesh3D(
  width: number,
  height: number,
  depth: number,
  nx: number,
  ny: number,
  nz: number,
  E: number,
  nu: number
): Mesh3D {
  const nodes: Node3D[] = [];
  const elements: Element3D[] = [];

  const dx = width / nx;
  const dy = height / ny;
  const dz = depth / nz;

  // 生成节点
  let nodeId = 0;
  for (let k = 0; k <= nz; k++) {
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        nodes.push({
          id: nodeId++,
          x: i * dx - width / 2,  // 居中
          y: j * dy,              // Y 向上
          z: k * dz - depth / 2,  // 居中
        });
      }
    }
  }

  // 生成六面体单元
  let elemId = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const n0 = k * (ny + 1) * (nx + 1) + j * (nx + 1) + i;
        const n1 = n0 + 1;
        const n2 = n0 + (nx + 1) + 1;
        const n3 = n0 + (nx + 1);
        const n4 = n0 + (ny + 1) * (nx + 1);
        const n5 = n4 + 1;
        const n6 = n4 + (nx + 1) + 1;
        const n7 = n4 + (nx + 1);

        elements.push({
          id: elemId++,
          nodes: [n0, n1, n2, n3, n4, n5, n6, n7],
        });
      }
    }
  }

  return { nodes, elements, E, nu };
}

/**
 * 应用底部固定边界条件
 */
export function applyBottomFixed3D(mesh: Mesh3D): void {
  const minY = Math.min(...mesh.nodes.map((n) => n.y));
  mesh.nodes.forEach((node) => {
    if (Math.abs(node.y - minY) < 1e-6) {
      node.fixedX = true;
      node.fixedY = true;
      node.fixedZ = true;
    }
  });
}

/**
 * 获取顶部节点
 */
export function getTopNodes3D(mesh: Mesh3D): Node3D[] {
  const maxY = Math.max(...mesh.nodes.map((n) => n.y));
  return mesh.nodes.filter((n) => Math.abs(n.y - maxY) < 1e-6);
}

/**
 * 共轭梯度法求解 (适合大型稀疏矩阵)
 */
function conjugateGradient(
  K: number[][],
  F: number[],
  maxIter: number = 1000,
  tol: number = 1e-6
): number[] {
  const n = F.length;
  const x = Array(n).fill(0);
  
  // r = F - K*x
  const r = [...F];
  const p = [...r];
  let rsOld = r.reduce((sum, val) => sum + val * val, 0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Ap = K * p
    const Ap = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Ap[i] += K[i][j] * p[j];
      }
    }

    const pAp = p.reduce((sum, val, i) => sum + val * Ap[i], 0);
    if (Math.abs(pAp) < 1e-15) break;
    
    const alpha = rsOld / pAp;

    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }

    const rsNew = r.reduce((sum, val) => sum + val * val, 0);
    if (Math.sqrt(rsNew) < tol) break;

    const beta = rsNew / rsOld;
    for (let i = 0; i < n; i++) {
      p[i] = r[i] + beta * p[i];
    }
    rsOld = rsNew;
  }

  return x;
}

/**
 * 计算单元应力
 */
function computeElementStress3D(
  element: Element3D,
  nodes: Node3D[],
  U: number[],
  E: number,
  nu: number
): ElementResult3D {
  const coords = element.nodes.map((nid) => {
    const n = nodes.find((node) => node.id === nid)!;
    return { x: n.x, y: n.y, z: n.z };
  });

  // 单元位移向量
  const ue: number[] = [];
  for (const nid of element.nodes) {
    ue.push(U[nid * 3]);
    ue.push(U[nid * 3 + 1]);
    ue.push(U[nid * 3 + 2]);
  }

  // 在单元中心计算应力
  const { dNdXi, dNdEta, dNdZeta } = shapeFunctionDerivatives3D(0, 0, 0);
  const { invJ } = computeJacobian3D(dNdXi, dNdEta, dNdZeta, coords);
  const B = computeBMatrix3D(dNdXi, dNdEta, dNdZeta, invJ);
  const D = computeDMatrix3D(E, nu);

  // 应变 ε = B * u
  const strain = Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 24; j++) {
      strain[i] += B[i][j] * ue[j];
    }
  }

  // 应力 σ = D * ε
  const stress = Array(6).fill(0);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      stress[i] += D[i][j] * strain[j];
    }
  }

  const [sigmaX, sigmaY, sigmaZ, tauXY, tauYZ, tauXZ] = stress;

  // 主应力 (简化计算)
  const I1 = sigmaX + sigmaY + sigmaZ;
  const I2 = sigmaX * sigmaY + sigmaY * sigmaZ + sigmaZ * sigmaX - tauXY * tauXY - tauYZ * tauYZ - tauXZ * tauXZ;
  const I3 = sigmaX * sigmaY * sigmaZ + 2 * tauXY * tauYZ * tauXZ - sigmaX * tauYZ * tauYZ - sigmaY * tauXZ * tauXZ - sigmaZ * tauXY * tauXY;

  // 使用特征值近似
  const p = I1 / 3;
  const q = (I1 * I1 - 3 * I2) / 9;
  const r = (2 * I1 * I1 * I1 - 9 * I1 * I2 + 27 * I3) / 54;

  let sigma1, sigma2, sigma3;
  if (q <= 0) {
    sigma1 = sigma2 = sigma3 = p;
  } else {
    const sqrtQ = Math.sqrt(q);
    const theta = Math.acos(Math.max(-1, Math.min(1, r / (q * sqrtQ)))) / 3;
    sigma1 = p + 2 * sqrtQ * Math.cos(theta);
    sigma2 = p + 2 * sqrtQ * Math.cos(theta - 2 * Math.PI / 3);
    sigma3 = p + 2 * sqrtQ * Math.cos(theta + 2 * Math.PI / 3);
  }

  // von Mises
  const vonMises = Math.sqrt(
    0.5 * ((sigma1 - sigma2) ** 2 + (sigma2 - sigma3) ** 2 + (sigma3 - sigma1) ** 2)
  );

  // 单元中心
  const cx = coords.reduce((sum, c) => sum + c.x, 0) / 8;
  const cy = coords.reduce((sum, c) => sum + c.y, 0) / 8;
  const cz = coords.reduce((sum, c) => sum + c.z, 0) / 8;

  return {
    elementId: element.id,
    sigmaX,
    sigmaY,
    sigmaZ,
    tauXY,
    tauYZ,
    tauXZ,
    sigma1,
    sigma2,
    sigma3,
    vonMises,
    cx,
    cy,
    cz,
  };
}

/**
 * 3D FEM 求解器
 * @param mesh 网格
 * @param appliedStress 施加的应力 (MPa, 负值=压缩)
 */
export function solve3D(mesh: Mesh3D, appliedStress: number): FEMResult3D {
  const ndof = mesh.nodes.length * 3;
  
  // 组装全局刚度矩阵
  const K: number[][] = Array(ndof).fill(null).map(() => Array(ndof).fill(0));

  for (const element of mesh.elements) {
    const Ke = computeElementStiffness3D(element, mesh.nodes, mesh.E, mesh.nu);

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const gi = element.nodes[i] * 3;
        const gj = element.nodes[j] * 3;

        for (let di = 0; di < 3; di++) {
          for (let dj = 0; dj < 3; dj++) {
            K[gi + di][gj + dj] += Ke[3 * i + di][3 * j + dj];
          }
        }
      }
    }
  }

  // 组装载荷向量
  const F: number[] = Array(ndof).fill(0);
  const topNodes = getTopNodes3D(mesh);
  
  // 计算顶面面积
  const topArea = topNodes.length > 0 ? 
    (Math.max(...topNodes.map(n => n.x)) - Math.min(...topNodes.map(n => n.x))) *
    (Math.max(...topNodes.map(n => n.z)) - Math.min(...topNodes.map(n => n.z))) : 1;
  
  const forcePerNode = (appliedStress * topArea) / topNodes.length;
  
  for (const node of topNodes) {
    F[node.id * 3 + 1] = forcePerNode; // Y方向力
  }

  // 应用边界条件 (罚函数法)
  const penalty = 1e15;
  for (const node of mesh.nodes) {
    if (node.fixedX) {
      K[node.id * 3][node.id * 3] += penalty;
    }
    if (node.fixedY) {
      K[node.id * 3 + 1][node.id * 3 + 1] += penalty;
    }
    if (node.fixedZ) {
      K[node.id * 3 + 2][node.id * 3 + 2] += penalty;
    }
  }

  // 求解
  const U = conjugateGradient(K, F);

  // 提取节点结果
  const nodeResults: NodeResult3D[] = mesh.nodes.map((node) => ({
    nodeId: node.id,
    ux: U[node.id * 3],
    uy: U[node.id * 3 + 1],
    uz: U[node.id * 3 + 2],
  }));

  // 计算单元应力
  const elementResults: ElementResult3D[] = mesh.elements.map((element) =>
    computeElementStress3D(element, mesh.nodes, U, mesh.E, mesh.nu)
  );

  const maxDisplacement = Math.max(
    ...nodeResults.map((n) => Math.sqrt(n.ux ** 2 + n.uy ** 2 + n.uz ** 2))
  );
  const maxVonMises = Math.max(...elementResults.map((e) => e.vonMises));

  return {
    nodes: nodeResults,
    elements: elementResults,
    maxDisplacement,
    maxVonMises,
  };
}

/**
 * 快速求解 - 用于实时更新
 * 预计算刚度矩阵，只更新载荷
 */
export class FEMSolver3D {
  private mesh: Mesh3D;
  private K: number[][] | null = null;
  private KWithBC: number[][] | null = null;

  constructor(mesh: Mesh3D) {
    this.mesh = mesh;
  }

  /**
   * 预计算刚度矩阵
   */
  precompute(): void {
    const ndof = this.mesh.nodes.length * 3;
    this.K = Array(ndof).fill(null).map(() => Array(ndof).fill(0));

    for (const element of this.mesh.elements) {
      const Ke = computeElementStiffness3D(element, this.mesh.nodes, this.mesh.E, this.mesh.nu);

      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const gi = element.nodes[i] * 3;
          const gj = element.nodes[j] * 3;

          for (let di = 0; di < 3; di++) {
            for (let dj = 0; dj < 3; dj++) {
              this.K[gi + di][gj + dj] += Ke[3 * i + di][3 * j + dj];
            }
          }
        }
      }
    }

    // 应用边界条件
    this.KWithBC = this.K.map(row => [...row]);
    const penalty = 1e15;
    for (const node of this.mesh.nodes) {
      if (node.fixedX) this.KWithBC[node.id * 3][node.id * 3] += penalty;
      if (node.fixedY) this.KWithBC[node.id * 3 + 1][node.id * 3 + 1] += penalty;
      if (node.fixedZ) this.KWithBC[node.id * 3 + 2][node.id * 3 + 2] += penalty;
    }
  }

  /**
   * 快速求解（使用预计算的刚度矩阵）
   */
  solve(appliedStress: number): FEMResult3D {
    if (!this.KWithBC) {
      this.precompute();
    }

    const ndof = this.mesh.nodes.length * 3;
    const F: number[] = Array(ndof).fill(0);
    
    const topNodes = getTopNodes3D(this.mesh);
    const topArea = topNodes.length > 0 ? 
      (Math.max(...topNodes.map(n => n.x)) - Math.min(...topNodes.map(n => n.x))) *
      (Math.max(...topNodes.map(n => n.z)) - Math.min(...topNodes.map(n => n.z))) : 1;
    
    const forcePerNode = (appliedStress * topArea) / topNodes.length;
    
    for (const node of topNodes) {
      F[node.id * 3 + 1] = forcePerNode;
    }

    const U = conjugateGradient(this.KWithBC!, F, 500, 1e-5);

    const nodeResults: NodeResult3D[] = this.mesh.nodes.map((node) => ({
      nodeId: node.id,
      ux: U[node.id * 3],
      uy: U[node.id * 3 + 1],
      uz: U[node.id * 3 + 2],
    }));

    const elementResults: ElementResult3D[] = this.mesh.elements.map((element) =>
      computeElementStress3D(element, this.mesh.nodes, U, this.mesh.E, this.mesh.nu)
    );

    const maxDisplacement = Math.max(
      ...nodeResults.map((n) => Math.sqrt(n.ux ** 2 + n.uy ** 2 + n.uz ** 2))
    );
    const maxVonMises = Math.max(...elementResults.map((e) => e.vonMises));

    return {
      nodes: nodeResults,
      elements: elementResults,
      maxDisplacement,
      maxVonMises,
    };
  }

  getMesh(): Mesh3D {
    return this.mesh;
  }
}
