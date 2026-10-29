export type Mode = 'learn' | 'practice' | 'assess' | 'replay';
export type Level = 'detail' | 'order' | 'rebuild' | 'images' | 'anomaly';
export type Verdict = 'correct' | 'incorrect' | 'uncertain';
export type AssessmentSource = 'codex' | 'rule' | 'api';
export interface Anomaly { id: string; category: string; prompt: string; rubric: string; broad: string; source?: string }
export interface Step {
  id: string; parentId?: string; title: string; summary: string; why: string;
  check: string; source: string; aliases?: string[]; media: string[];
}
export interface LabCase {
  id: string; title: string; subtitle: string; discipline: string; revision: number;
  rootId: string; practiceParent: string; practiceParents: string[]; steps: Step[]; sequence: string[];
  sources: string[]; caveats: string[]; anomalies: Anomaly[];
}
export interface AnswerNode { id: string; label: string; position: { x: number; y: number }; media: string[] }
export interface AnswerEdge {
  id: string; source: string; target: string;
  sourceHandle?: string | null; targetHandle?: string | null;
}
export interface Answer { nodes: AnswerNode[]; edges: AnswerEdge[]; text: string }
export interface PublicTask {
  id: string; caseId: string; revision: number; level: Level; prompt: string;
  initial: Answer; media: string[]; helpLevel: number; assisted: boolean;
  parentId: string; questionId?: string;
  generation?: { source: 'preset' | 'ai'; message: string };
}
export interface Assessment { verdict: Verdict; detail: string; focusIndex?: number; source: AssessmentSource; degraded?: boolean; }
export interface Feedback {
  verdict: Verdict; message: string; source: AssessmentSource; helpLevel: number; assisted: boolean;
  snapshotId: string; submittedAt: string; degraded?: boolean;
}
export interface PublicJob { id: string; status: 'running' | 'completed' | 'failed' | 'cancelled'; feedback?: Feedback; message?: string }
export interface Progress { [key: string]: { independent: string[]; aided: number; seen: number } }
