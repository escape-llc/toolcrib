import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useStableId } from '../shared/useStableId';
import { getSparseVariables } from '../../theme/slice';
import { StepperThemeSlice, StepperSliceState } from './StepperSlice';

/** Data shape for each step in a `<Stepper>`. */
export interface StepperStepData {
  /** Unique key for this step. */
  id: string;
  /** Label rendered next to this step's number/checkmark indicator. */
  label: ReactNode;
  /** Content rendered for this step. */
  content: ReactNode;
  /**
   * If given, forward navigation past this step is blocked until a
   * `<Form id={formId}>` somewhere in `content` reports `isValid: true`
   * over the event bus (`form:validated`). Omit for a step with no form to
   * gate on (e.g. a pure informational/review step).
   */
  formId?: string;
  /** If true, this step can never be navigated to directly (still counts toward the linear sequence). */
  disabled?: boolean;
}

export interface StepperProps {
  /** Unique identifier for `stepper:changed` event bus payloads. Auto-generated if omitted. */
  id?: string;
  /** Steps to render, in order. */
  steps: StepperStepData[];
  /** Controlled active step index. */
  activeIndex?: number;
  /** Initial active step index when uncontrolled. @default 0 */
  defaultActiveIndex?: number;
  /** Called whenever the active step changes, whether controlled or uncontrolled. */
  onActiveIndexChange?: (index: number) => void;
  /** Per-instance override for indicator/label size. */
  overrides?: Partial<StepperSliceState>;
}

/**
 * @manifest Linear step wizard built on the same Radix Tabs primitive as `<TabStrip>`, with per-step Form validation gating
 * @manifestConstraints Forward navigation past a step with `formId` set is blocked until that step's `<Form>` reports `isValid: true`
 * @manifestCategory Data Display
 */
export const Stepper: React.FC<StepperProps> = ({
  id: propId,
  steps,
  activeIndex: controlledIndex,
  defaultActiveIndex = 0,
  onActiveIndexChange,
  overrides,
}) => {
  const id = useStableId(propId, 'stepper');
  const stepperVars = getSparseVariables(StepperThemeSlice, overrides ?? {});

  const [internalIndex, setInternalIndex] = useState(defaultActiveIndex);
  const isControlled = controlledIndex !== undefined;
  const activeIndex = isControlled ? controlledIndex : internalIndex;

  // Tracks the live validity of every formId any step names, keyed by that
  // formId -- the one place in this component that listens for an
  // *existing* event channel instead of only emitting new ones. A gated
  // step with no report yet (the form hasn't had a field touched) is
  // treated as unsatisfied, not optimistically valid -- an untouched
  // required-field form is exactly the case forward navigation should
  // still block.
  const [formValidity, setFormValidity] = useState<Record<string, boolean>>({});
  useAIEvent('form:validated', e => {
    if (!e.formId) return;
    setFormValidity(prev => (prev[e.formId!] === e.isValid ? prev : { ...prev, [e.formId!]: e.isValid }));
  });

  const isStepSatisfied = (step: StepperStepData) => !step.formId || formValidity[step.formId] === true;

  // The furthest index reachable by advancing sequentially from step 0 --
  // every step strictly before it must be satisfied. Recomputed from
  // current validity each render (not "highest ever visited"), so
  // re-invalidating an earlier step's form after going back correctly
  // blocks re-advancing past it again.
  let maxReachableIndex = 0;
  while (maxReachableIndex < steps.length - 1 && isStepSatisfied(steps[maxReachableIndex])) {
    maxReachableIndex++;
  }

  const previousIndexRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    aiBus.emit('stepper:changed', { id, activeIndex, previousIndex: undefined });
    previousIndexRef.current = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(index, steps.length - 1));
    if (clamped > maxReachableIndex || steps[clamped]?.disabled) return;
    if (!isControlled) setInternalIndex(clamped);
    onActiveIndexChange?.(clamped);
    if (clamped !== previousIndexRef.current) {
      aiBus.emit('stepper:changed', { id, activeIndex: clamped, previousIndex: previousIndexRef.current });
      previousIndexRef.current = clamped;
    }
  };

  const activeStep = steps[activeIndex];
  const canAdvance = activeStep ? isStepSatisfied(activeStep) && activeIndex < steps.length - 1 : false;

  return (
    <TabsPrimitive.Root
      value={activeStep?.id}
      onValueChange={val => {
        const index = steps.findIndex(s => s.id === val);
        if (index >= 0) goToIndex(index);
      }}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', ...stepperVars }}
    >
      <TabsPrimitive.List style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem' }}>
        {steps.map((step, index) => {
          const isCompleted = index < activeIndex && isStepSatisfied(step);
          const isActive = index === activeIndex;
          const isReachable = index <= maxReachableIndex && !step.disabled;
          return (
            <React.Fragment key={step.id}>
              <TabsPrimitive.Trigger
                value={step.id}
                disabled={!isReachable}
                aria-current={isActive ? 'step' : undefined}
                className="ai-focus-ring"
                style={{
                  all: 'unset',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isReachable ? 'pointer' : 'not-allowed',
                  opacity: isReachable ? 1 : 0.5,
                }}
              >
                <span
                  style={{
                    width: 'var(--ai-stepper-indicator-size, 1.875rem)',
                    height: 'var(--ai-stepper-indicator-size, 1.875rem)',
                    borderRadius: '999rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--ai-stepper-font-size, 0.875rem)',
                    fontWeight: 'var(--ai-font-weight-semibold, 600)',
                    flexShrink: 0,
                    background: isActive || isCompleted ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-container, #f3f4f6)',
                    color: isActive || isCompleted ? 'var(--ai-color-on-primary, #ffffff)' : 'var(--ai-text-secondary, #6b7280)',
                  }}
                >
                  {isCompleted ? '✓' : index + 1}
                </span>
                <span
                  style={{
                    fontSize: 'var(--ai-stepper-font-size, 0.875rem)',
                    fontWeight: isActive ? 'var(--ai-font-weight-semibold, 600)' : 'var(--ai-font-weight-normal, 400)',
                    color: isActive ? 'var(--ai-text-primary, #111827)' : 'var(--ai-text-secondary, #6b7280)',
                  }}
                >
                  {step.label}
                </span>
              </TabsPrimitive.Trigger>
              {index < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: '0.125rem',
                    margin: '0 0.75rem',
                    background: index < maxReachableIndex ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #e5e7eb)',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </TabsPrimitive.List>

      {steps.map(step => (
        <TabsPrimitive.Content key={step.id} value={step.id} style={{ flex: 1 }}>
          {step.content}
        </TabsPrimitive.Content>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
        <button
          type="button"
          onClick={() => goToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="ai-btn"
          style={{
            padding: 'var(--ai-padding-md, 0.5rem 1rem)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            background: 'var(--ai-bg-surface, #ffffff)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: activeIndex === 0 ? 0.5 : 1,
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => goToIndex(activeIndex + 1)}
          disabled={!canAdvance}
          className="ai-btn"
          style={{
            padding: 'var(--ai-padding-md, 0.5rem 1rem)',
            border: 'none',
            background: 'var(--ai-color-primary, #3b82f6)',
            color: 'var(--ai-color-on-primary, #ffffff)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
            opacity: canAdvance ? 1 : 0.5,
          }}
        >
          Next
        </button>
      </div>
    </TabsPrimitive.Root>
  );
};
