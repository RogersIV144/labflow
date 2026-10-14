import { CodexBridge, evaluationSchema } from '../server/codex';
const bridge = new CodexBridge();
try {
  console.log(await bridge.status());
  console.log(await bridge.models());
  const result = await bridge.run('Reference: first blocking, then primary antibody, then washing. Learner: primary antibody, blocking, washing. Evaluate the order. Return verdict and a short private diagnosis.', evaluationSchema);
  console.log({ realCodexResult: result });
  if (result.verdict !== 'incorrect') process.exitCode = 1;
} finally { bridge.close(); }
