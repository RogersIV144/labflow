export type Point = { x: number; y: number };
export type HierarchyItem = { id: string; parentId?: string };
export type HierarchyRoute = { viaX: number; viaY: number };

/** Place one parent above its children and preserve the supplied process order. */
export function layoutLearning(ids: string[], sequence: string[], steps: HierarchyItem[] = [], heights: Record<string, number> = {}, cardWidth = 196, gap = 20, rowSize = 3) {
  const order = new Map(sequence.map((id, index) => [id, index]));
  const childrenByParent = new Map<string, string[]>();
  steps.forEach(step => { if (step.parentId) childrenByParent.set(step.parentId, [...(childrenByParent.get(step.parentId) ?? []), step.id]); });
  const earliestLeaf = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return Number.MAX_SAFE_INTEGER;
    const path = new Set(seen); path.add(id);
    const children = childrenByParent.get(id) ?? [];
    if (!children.length) return order.get(id) ?? Number.MAX_SAFE_INTEGER;
    return Math.min(...children.map(child => earliestLeaf(child, path)));
  };
  const inputOrder = new Map(ids.map((id, index) => [id, index]));
  const children = ids.slice(1).sort((a, b) => earliestLeaf(a) - earliestLeaf(b) || inputOrder.get(a)! - inputOrder.get(b)!);
  const rows: string[][] = [];
  for (let i = 0; i < children.length; i += rowSize) rows.push(children.slice(i, i + rowSize));
  const positions: Record<string, Point> = {};
  const parentWidth = cardWidth;
  positions[ids[0]] = { x: (Math.max(1, Math.min(rowSize, children.length)) * (cardWidth + gap) - gap - parentWidth) / 2, y: 0 };
  const measuredHeight=(id:string)=>Math.max(96,heights[id]||160);
  const rowBottoms: number[]=[];
  let nextTop=measuredHeight(ids[0])+52;
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * cardWidth + (row.length - 1) * gap;
    const maxWidth = Math.max(parentWidth, Math.min(rowSize, children.length) * (cardWidth + gap) - gap);
    const startX = Math.max(0, (maxWidth - rowWidth) / 2);
    row.forEach((id, index) => { positions[id] = { x: startX + index * (cardWidth + gap), y: nextTop }; });
    rowBottoms[rowIndex]=nextTop+Math.max(...row.map(measuredHeight));
    nextTop=rowBottoms[rowIndex]+80;
  });
  const width = Math.max(parentWidth, Math.min(rowSize, children.length) * (cardWidth + gap) - gap);
  const edges = children.map((id, index) => {
    const row = Math.floor(index / rowSize);
    if (row === 0) return { source: ids[0], target: id, sourceHandle: 'bottom', targetHandle: 'top', route: undefined as HierarchyRoute | undefined };
    // Bypass the preceding row in the outside gutters. Keep the horizontal
    // branches in the gap between rows so none appears to start at a card.
    const left = index % rowSize < 2;
    const viaX = left ? -36 : width + 36;
    const viaY = rowBottoms[row-1] + (index % rowSize === 1 ? 28 : 44);
    return { source: ids[0], target: id, sourceHandle: left ? 'hierarchy-left' : 'right', targetHandle: 'top', route: { viaX, viaY } };
  });
  return { positions, edges };
}

/** Older drafts lacked handle IDs. Restore their visible direction from node positions. */
export function legacyEdgeHandles(source: Point | undefined, target: Point | undefined) {
  if (!source || !target) return { sourceHandle: 'bottom', targetHandle: 'top' };
  const dx = target.x - source.x; const dy = target.y - source.y;
  // Tray rows are spaced about 180-190 px apart. A wrapped link from the
  // last card of one row to the first card of the next spans farther sideways
  // than vertically, but still needs to leave below and enter above.
  if (Math.abs(dy) >= 140) return dy >= 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'legacy-top-source', targetHandle: 'legacy-bottom-target' };
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'legacy-left-source', targetHandle: 'legacy-right-target' };
  return dy >= 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'legacy-top-source', targetHandle: 'legacy-bottom-target' };
}

export function serializeAnswerEdges(edges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[]) {
  return edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined }));
}

/** Layout only what the learner drew. With no links, keep the existing tray order. */
export function layoutAnswer(ids: string[], positions: Record<string, Point>, links: { source: string; target: string }[], cardWidth = 248, gap = 56) {
  if (!links.length) {
    const tray = [...ids].sort((a, b) => (positions[a]?.y ?? 0) - (positions[b]?.y ?? 0) || (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0));
    return Object.fromEntries(tray.map((id, index) => [id, { x: (index % 3) * (cardWidth + gap), y: Math.floor(index / 3) * 190 }]));
  }
  const incoming = new Map<string, number>(); const outgoing = new Map<string, string[]>();
  ids.forEach(id => { incoming.set(id, 0); outgoing.set(id, []); });
  links.forEach(({ source, target }) => { if (outgoing.has(source) && incoming.has(target)) { outgoing.get(source)!.push(target); incoming.set(target, incoming.get(target)! + 1); } });
  const rank = new Map<string, number>(); const queue = ids.filter(id => incoming.get(id) === 0);
  queue.forEach(id => rank.set(id, 0));
  for (let i = 0; i < queue.length; i++) for (const next of outgoing.get(queue[i]) ?? []) {
    rank.set(next, Math.max(rank.get(next) ?? 0, (rank.get(queue[i]) ?? 0) + 1));
    incoming.set(next, incoming.get(next)! - 1); if (incoming.get(next) === 0) queue.push(next);
  }
  ids.forEach(id => { if (!rank.has(id)) rank.set(id, 0); });
  const groups = new Map<number, string[]>();
  ids.forEach(id => { const r = rank.get(id)!; groups.set(r, [...(groups.get(r) ?? []), id]); });
  const result: Record<string, Point> = {};
  [...groups.entries()].forEach(([r, group]) => group.forEach((id, i) => {
    result[id] = { x: i * (cardWidth + gap), y: r * 220 };
  }));
  return result;
}

