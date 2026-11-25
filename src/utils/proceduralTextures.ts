import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

function finalizeTexture(canvas: HTMLCanvasElement, key: string, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates an intricate ATX Motherboard PCB top texture with copper traces,
 * solder vias, mounting hole rings, and accurate silkscreen socket labels.
 */
export function getMotherboardPcbTexture(boardName: string, socketLabel: string, ramLabel: string): THREE.CanvasTexture {
  const key = `pcb_${boardName}_${socketLabel}_${ramLabel}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const w = 1024;
  const h = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Matte black-navy solder mask base
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#0c121b');
  bgGrad.addColorStop(0.5, '#0f1622');
  bgGrad.addColorStop(1, '#0a0f18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle fiberglass weave micro-grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Helper to convert PCB local (x in [-1.22, 1.22], z in [-1.525, 1.525]) -> canvas px
  const toX = (mx: number) => ((mx + 1.22) / 2.44) * w;
  const toY = (mz: number) => ((mz + 1.525) / 3.05) * h;

  // Copper signal trace buses (CPU -> DIMM, CPU -> PCIe, CPU -> M.2, Chipset -> SATA)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 2;
  // CPU to RAM traces
  for (let i = 0; i < 18; i++) {
    const y0 = toY(-1.05 + i * 0.036);
    ctx.beginPath();
    ctx.moveTo(toX(0.05), y0);
    ctx.lineTo(toX(0.24), y0);
    ctx.lineTo(toX(0.32), y0 + (i % 2 === 0 ? 10 : -10));
    ctx.lineTo(toX(0.42), y0 + (i % 2 === 0 ? 10 : -10));
    ctx.stroke();
  }

  // CPU to PCIe x16 & M.2 traces
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  for (let i = 0; i < 14; i++) {
    const x0 = toX(-0.42 + i * 0.036);
    ctx.beginPath();
    ctx.moveTo(x0, toY(-0.48));
    ctx.lineTo(x0, toY(-0.22));
    ctx.lineTo(x0 + 14, toY(-0.14));
    ctx.lineTo(x0 + 14, toY(0.20));
    ctx.stroke();
  }

  // Chipset to SATA & Front Panel traces
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  for (let i = 0; i < 10; i++) {
    const y0 = toY(0.54 + i * 0.044);
    ctx.beginPath();
    ctx.moveTo(toX(0.75), y0);
    ctx.lineTo(toX(1.06), y0);
    ctx.stroke();
  }

  // Audio isolated ground plane glowing line
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(toX(-1.18), toY(0.45));
  ctx.lineTo(toX(-0.96), toY(0.55));
  ctx.lineTo(toX(-0.96), toY(1.48));
  ctx.stroke();

  // Diagonal architectural lab graphic stripe
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(toX(0.35), toY(0.18));
  ctx.lineTo(toX(1.16), toY(0.18));
  ctx.stroke();

  // Solder vias scattered realistically along buses
  ctx.fillStyle = '#d4af37';
  for (let i = 0; i < 70; i++) {
    const vx = ((i * 137) % 920) + 52;
    const vy = ((i * 251) % 1160) + 60;
    ctx.beginPath();
    ctx.arc(vx, vy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 9 Standard ATX brass standoff mounting rings
  const mountCoords: [number, number][] = [
    [-1.10, -1.40], [0.02, -1.40], [1.10, -1.40],
    [-1.10, 0.02], [0.02, 0.02], [1.10, 0.02],
    [-1.10, 1.40], [0.02, 1.40], [1.10, 1.40],
  ];
  for (const [mx, mz] of mountCoords) {
    const cx = toX(mx);
    const cy = toY(mz);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#05080f';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp silkscreen typography
  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(boardName.toUpperCase(), toX(-0.98), toY(0.06));
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.fillText(`${socketLabel} · ${ramLabel} · ATX REV 2.4`, toX(-0.98), toY(0.11));

  // Silkscreen socket & header labels
  ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
  ctx.font = '600 12px "JetBrains Mono", monospace';
  const labels: [string, number, number][] = [
    ['CPU_PWR 8P', -0.96, -1.45],
    ['CPU_FAN', 0.06, -1.45],
    ['DIMM A1 A2 B1 B2', 0.38, -1.41],
    ['ATX_24P', 0.90, -0.98],
    ['M2_1 PCIe4 x4', -0.52, -0.25],
    ['PCIEX16_1 GEN5', -0.78, 0.36],
    ['PCIEX1_1', -0.88, 0.67],
    ['M2_2 PCIe4 x4', -0.52, 0.88],
    ['PCIEX1_2', -0.88, 1.12],
    ['CMOS BAT1', -0.32, 1.27],
    ['BIOS_ROM', 0.08, 1.24],
    ['HD_AUDIO', -1.02, 1.49],
    ['SYS_FAN1', -0.44, 1.49],
    ['USB3_2', 0.22, 1.49],
    ['F_PANEL', 0.76, 1.49],
    ['SATA6G 1-4', 0.88, 1.14],
  ];
  for (const [text, lx, lz] of labels) {
    ctx.fillText(text, toX(lx), toY(lz));
  }

  // Border hairline
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  return finalizeTexture(canvas, key);
}

/**
 * Generates an ESD anti-static workbench mat texture with ruler ticks and technical grid.
 */
export function getWorkbenchMatTexture(): THREE.CanvasTexture {
  const key = 'workbench_esd_mat';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0b121e';
  ctx.fillRect(0, 0, w, h);

  // Subtle major & minor engineering grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= w; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= w; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }

  // ESD Mat border & ruler markings
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.32)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText('ESD SAFE ASSEMBLY SURFACE · 100MM SCALE GRID', 44, 54);
  ctx.fillText('ATX FORM FACTOR 305 x 244 MM', 44, h - 40);

  return finalizeTexture(canvas, key);
}

/**
 * Generates laser-etched CPU Integrated Heat Spreader (IHS) texture with orientation triangle.
 */
export function getCpuIhsTexture(brand: string, model: string, socket: string): THREE.CanvasTexture {
  const key = `cpu_ihs_${brand}_${model}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#cfd8e3');
  grad.addColorStop(0.5, '#b6c2d1');
  grad.addColorStop(1, '#9aa8ba');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle brushed nickel horizontal lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Laser etched text
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(brand.toUpperCase(), size / 2, 165);
  ctx.font = '600 32px "JetBrains Mono", monospace';
  ctx.fillText(model, size / 2, 235);
  ctx.font = '500 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(socket, size / 2, 295);
  ctx.fillText('SRK24 · 5.80GHz', size / 2, 340);

  // Prominent Gold Pin-1 Orientation Triangle (bottom-left corner)
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(34, size - 34);
  ctx.lineTo(104, size - 34);
  ctx.lineTo(34, size - 104);
  ctx.closePath();
  ctx.fill();

  return finalizeTexture(canvas, key);
}

/**
 * Generates an M.2 NVMe SSD top label texture.
 */
export function getNvmeLabelTexture(model: string): THREE.CanvasTexture {
  const key = `nvme_${model}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const w = 512;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, 14, h);
  ctx.fillRect(0, h - 10, w, 10);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('HYPERNVME PRO', 36, 62);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText('2TB · PCIe 4.0 x4 · M.2 2280', 36, 108);

  return finalizeTexture(canvas, key);
}

/**
 * Generates PSU side nameplate texture.
 */
export function getPsuLabelTexture(wattage: number, rating: string): THREE.CanvasTexture {
  const key = `psu_${wattage}_${rating}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = wattage >= 800 ? '#f59e0b' : '#eab308';
  ctx.fillRect(0, 0, 18, h);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 58px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${wattage}W`, 44, 112);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText(`ATX 3.0 · ${rating.toUpperCase()}`, 44, 162);
  ctx.fillText('+12V SINGLE RAIL · MODULAR', 44, 202);

  return finalizeTexture(canvas, key);
}

/**
 * Generates CPU Socket LGA pin grid texture.
 */
export function getCpuSocketPinTexture(): THREE.CanvasTexture {
  const key = 'cpu_socket_pins';
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, size, size);

  // Micro gold contact array
  ctx.fillStyle = '#d4af37';
  for (let y = 14; y < size - 14; y += 6) {
    for (let x = 14; x < size - 14; x += 6) {
      // Leave central SMD capacitor cutout
      if (x > 92 && x < 164 && y > 92 && y < 164) continue;
      ctx.fillRect(x, y, 3, 3);
    }
  }

  // Center SMD capacitors
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(94, 94, 68, 68);
  ctx.fillStyle = '#94a3b8';
  for (let y = 102; y < 156; y += 12) {
    for (let x = 102; x < 156; x += 16) {
      ctx.fillRect(x, y, 10, 5);
    }
  }

  return finalizeTexture(canvas, key);
}
