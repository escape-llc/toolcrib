// Types for manifestContracts.js, so formControlContract.test.tsx can import
// it under root's strict tsc without enabling allowJs (the same reason
// securityAdvisories.d.ts exists).
export const STATE_PROPS: Record<'default' | 'focused' | 'disabled' | 'invalid' | 'read-only', string[] | null>;
export const FORM_CONTRACT_CHECKS: string[];
export interface GuaranteeDefinition {
  summary: string;
  enforcedBy: string;
  checks: string[];
  requiresStates?: string[];
}
export const GUARANTEES: Record<string, GuaranteeDefinition>;
export function validateStates(components: unknown[]): void;
export function validateGuarantees(components: unknown[]): void;
