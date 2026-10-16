import { describe, expect, it } from 'vitest';
import { layoutAnswer, layoutLearning } from './layout';

describe('graph layouts', () => {
  it('places the learning parent above ordered child steps with structural links', () => {
    const result = layoutLearning(['root', 'c', 'a', 'b'], ['root', 'a', 'b', 'c']);
    expect(result.positions.root.y).toBeLessThan(result.positions.a.y);
    expect(result.edges).toEqual([{ source: 'root', target: 'a', sourceHandle: 'bottom', targetHandle: 'top' }, { source: 'root', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' }, { source: 'root', target: 'c', sourceHandle: 'bottom', targetHandle: 'top' }]);
  });

  it('orders a parent stage by its first process leaf, not the parent node index', () => {
    const ids = ['root', 'prepare', 'sample', 'separate', 'antibody', 'image', 'interpret'];
    const steps = [
      { id: 'prepare', parentId: 'root' }, { id: 'sample', parentId: 'root' },
      { id: 'separate', parentId: 'root' }, { id: 'antibody', parentId: 'root' },
      { id: 'image', parentId: 'root' }, { id: 'interpret', parentId: 'root' },
      { id: 'lysis', parentId: 'sample' }, { id: 'gel', parentId: 'separate' },
      { id: 'block', parentId: 'antibody' }, { id: 'band', parentId: 'interpret' }
    ];
    const result = layoutLearning(ids, ['prepare', 'lysis', 'gel', 'block', 'image', 'band'], steps);
    expect(result.edges.map(edge => edge.target)).toEqual(['prepare', 'sample', 'separate', 'antibody', 'image', 'interpret']);
  });

  it('does not infer ordering when there are no learner-created links', () => {
    const positions = { a: { x: 304, y: 0 }, b: { x: 0, y: 0 } };
    const arranged = layoutAnswer(['a', 'b'], positions, []);
    expect(arranged.b.x).toBeLessThan(arranged.a.x);
    expect(arranged.b.y).toBe(arranged.a.y);
  });

  it('organizes from learner links only', () => {
    const result = layoutAnswer(['a', 'b', 'c'], { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }, [{ source: 'b', target: 'c' }]);
    expect(result.b.y).toBeLessThan(result.c.y);
    expect(result.a.y).toBe(result.b.y);
  });
});
