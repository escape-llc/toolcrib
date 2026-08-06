# Overview of AI-UI

when i am vibe coding projects in react, the ai just auto-duplicates lots of the same ui elements, like popups and slide outs etc.

i want to create a UI package that is tailored for consumption by AI systems.  this gives the AI a "toolkit" to start out with some structural UI components, plus all the basics.

also central to the toolkit is an OOTB "theme editor" panel.

when constructing the source code, make sure to document for AI consumption.

another part of the toolkit is theming of all the components, plus ones the AI generates. the component structure must be amenable to how an AI wants to format react components.

# AI-UI Component library

this is a UI component library for React, designed for consumption by AI systems.  it provides a "toolkit" of structural UI components, plus all the basics. central to this toolkit is a "theme" system controlled by CSS variables, and ideally everything else derives from that.  also central to the toolkit is an OOTB "theme editor" panel. when constructing the source code, make sure to document for AI consumption. another part of the toolkit is theming of all the components, plus ones the AI generates. the component structure must be amenable to how an AI wants to format react components.

# TypeScript

Full typescript support on everything! Important to keep the AI from hallucinating props, types, or anything else.

# CSS Variables

central to this toolkit is a "theme" system controlled by CSS variables, and ideally everything else derives from that.

# Colors and Color Themes

All color calculations are in HSV color space. Carry this through the entire implementation.  No RGB allowed. Use the CSS color space transformations to lighten/darken etc.

The following Color Themes are supported:
- Monochromatic
- Analogous
- Split Complimentary
- Triadic
- Tetradic

Additional Paramters:
- Hue spread
- darken/lighten factor
- Saturation factor

Light and Dark modes must be supported.

The palette should be applied to all UI components (and ones AI generate).

## Base Color

One distinguished color is the Base Color of the Theme, from which the rest are generated. 

## Sub themes

It is possible to create additional "sub themes" anchored off an arbitrary color, e.g. "red" for error themes.

# Component Design

Follow best-practice React component design.

## Slots

Use slots for all major areas of a component.  For example, a "Card" would have slots for "header" and "content".

## No Prop-Drilling

Do not pass props deep into the component structure.  Use slots or composition instead.

Use contexts for passing theme info etc.  Ensure that this is documented for AI consumption.

# Forms Component

Add a "form" component that manages a ZOD 4 schema based validation engine. Create the necessary components to support this, so AI can provide schema and error layout.

# Event Bus

A central component of the toolkit is the (stongly-typed) Event Bus. It facilitates Cross-tree action dispatching.

Example Events:
- Theme changed
- Popup shown
- Popup hidden
- Slide out shown
- Slide out hidden
- Modal shown
- Modal hidden
- Form submitted
- Form validated
- Form errored

```typescript
// AI uses this hook - subscription & cleanup happen automatically:
useAIEvent('modal:open', (event) => {
  if (event.id === 'delete-confirm') setTargetId(event.data);
});
```

# Component List

Search the web for existing toolkits; this is the basic list.

## Form

All the usual Form controls must be supported.

## Popup

Popup containers must be supported and have correct trigger element anchoring.  Support light dismiss.

## Slide out

Slide out containers must be supported and have correct trigger element anchoring.

## Modal

Modal containers must be supported and have correct trigger element anchoring. They must correctly lock out UI traversal outside the modal.

## Toasts

Complete toast subsystem with multiple actions, anchor points, durations, and priority levels.

## Data Table

There must be a data table component with virtualization and pagination.

## Theme Editor

There must be a theme editor panel that allows the user to edit the theme variables and see the changes in real-time.

## Documentation

Documentation must be suitable for AI consumption and clearly show component structure, slots, and theme integration.

# Implementation

Use functional components and hooks.

Write unit tests for all components.

Follow best practices for component design and implementation.

Document the implementation for AI consumption.