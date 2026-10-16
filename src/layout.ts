export type Point = { x: number; y: number };
export type HierarchyItem = { id: string; parentId?: string };

/** Place one parent above its children and preserve the supplied process order. */
export function layoutLearning(ids: string[], sequence: string[], steps: HierarchyItem[] = [], cardWidth = 196, gap = 20, rowSize = 3) {
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
  rows.forEach((row, rowIndex) => {
    const rowWidth = row.length * cardWidth + (row.length - 1) * gap;
    const maxWidth = Math.max(parentWidth, Math.min(rowSize, children.length) * (cardWidth + gap) - gap);
    const startX = Math.max(0, (maxWidth - rowWidth) / 2);
    row.forEach((id, index) => { positions[id] = { x: startX + index * (cardWidth + gap), y: 165 + rowIndex * 185 }; });
  });
  return { positions, edges: children.map(id => ({ source: ids[0], target: id, sourceHandle: 'bottom', targetHandle: 'top' })) };
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

