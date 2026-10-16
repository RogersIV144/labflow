import { describe, expect, it } from 'vitest';
import { layoutAnswer, layoutLearning, legacyEdgeHandles, serializeAnswerEdges } from './layout';

describe('graph layouts', () => {
  it('places the learning parent above ordered child steps with structural links', () => {
    const result = layoutLearning(['root', 'c', 'a', 'b'], ['root', 'a', 'b', 'c']);
    expect(result.positions.root.y).toBeLessThan(result.positions.a.y);
    expect(result.edges.map(({ route, ...edge }) => edge)).toEqual([{ source: 'root', target: 'a', sourceHandle: 'bottom', targetHandle: 'top' }, { source: 'root', target: 'b', sourceHandle: 'bottom', targetHandle: 'top' }, { source: 'root', target: 'c', sourceHandle: 'bottom', targetHandle: 'top' }]);
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

  it('routes later hierarchy rows outside earlier cards before branching below them', () => {
    const heights={root:152,a:115,b:150,c:150,d:128,e:160,f:120};
    const result = layoutLearning(['root','a','b','c','d','e','f'], ['a','b','c','d','e','f'], [], heights);
    const firstRow=['a','b','c'].map(id=>result.positions[id]);
    const lower=result.edges.filter(edge=>['d','e','f'].includes(edge.target));
    expect(lower).toHaveLength(3);
    expect(firstRow[0].y).toBeGreaterThan(heights.root);
    for (const edge of lower) {
      expect(edge.route).toBeDefined();
      const {viaX,viaY}=edge.route!;
      expect(viaX<firstRow[0].x || viaX>firstRow[2].x+196).toBe(true);
      expect(viaY).toBeGreaterThan(firstRow[0].y+Math.max(heights.a,heights.b,heights.c));
      expect(viaY).toBeLessThan(result.positions[edge.target].y);
      expect(edge.source).toBe('root');
    }
    const taller=layoutLearning(['root','a','b','c','d','e','f'], ['a','b','c','d','e','f'], [], {...heights,b:250});
    expect(taller.positions.d.y).toBe(result.positions.d.y+100);
    expect(taller.edges.find(edge=>edge.target==='d')!.route!.viaY).toBeGreaterThan(taller.positions.b.y+250);
  });

  it('restores older edges to directional handles from their node positions', () => {
    expect(legacyEdgeHandles({x:0,y:0},{x:300,y:0})).toEqual({sourceHandle:'right',targetHandle:'left'});
    expect(legacyEdgeHandles({x:0,y:0},{x:0,y:220})).toEqual({sourceHandle:'bottom',targetHandle:'top'});
    expect(legacyEdgeHandles({x:300,y:0},{x:0,y:0})).toEqual({sourceHandle:'legacy-left-source',targetHandle:'legacy-right-target'});
    expect(legacyEdgeHandles({x:0,y:220},{x:0,y:0})).toEqual({sourceHandle:'legacy-top-source',targetHandle:'legacy-bottom-target'});
    expect(legacyEdgeHandles({x:608,y:0},{x:0,y:180})).toEqual({sourceHandle:'bottom',targetHandle:'top'});
  });

  it('keeps the actual connection handles in saved learner answers', () => {
    expect(serializeAnswerEdges([{id:'e',source:'a',target:'b',sourceHandle:'right',targetHandle:'left'}]))
      .toEqual([{id:'e',source:'a',target:'b',sourceHandle:'right',targetHandle:'left'}]);
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
