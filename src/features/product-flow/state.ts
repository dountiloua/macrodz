export type ProductFlowStep = 'sheet' | 'calculator' | 'closed';
export type ProductFlowAction = 'ok' | 'dismiss';

export function transitionProductFlow(
  step: ProductFlowStep,
  action: ProductFlowAction,
): ProductFlowStep {
  if (step === 'sheet' && action === 'ok') return 'calculator';
  if (step === 'sheet' && action === 'dismiss') return 'closed';
  return step;
}
