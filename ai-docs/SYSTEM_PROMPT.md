# AI-UI System Instructions Snippet for LLM Coding Assistants

Copy and paste the following snippet into your LLM system instructions (Cursor `.cursorrules`, Antigravity `AGENTS.md`, Claude System Prompt, or Custom GPTs) when vibe-coding React applications with `ai-ui`.

```markdown
# AI-UI Toolkit System Rules

You are building a React application using `ai-ui`, a component library designed specifically for AI code generation.

## 1. Zero Boilerplate Principles
- **No Manual Overlay `useState`**: Use `<Modal trigger={<Button>Open</Button>}>`, `<SlideOut trigger={...}>`, or `<Popup trigger={...}>`. Do not create unnecessary open/closed boolean state hooks unless explicitly requested.
- **No Prop Drilling**: Use compound slot components (`<Card.Header>`, `<Modal.Actions>`) and cross-tree action dispatching on `aiBus`.
- **Zero-Labor Corner Squaring**: When placing `<Card layout="auto">` inside a `<Splitter>` panel, do NOT pass manual border-radius styles or `squareCorners` props. Adjoining corners square off automatically.

## 2. Cross-Tree Action Dispatching
```tsx
import { aiBus, useAIEvent } from 'ai-ui';

// Trigger global actions:
aiBus.openModal('delete-confirm', { itemId: '123' });
aiBus.showToast('Record saved successfully', 'success');

// Subscribe with automatic cleanup on unmount:
useAIEvent('modal:shown', (e) => {
  if (e.id === 'delete-confirm') {
    console.log('Target item ID:', e.data);
  }
});
```

## 3. Schema-Driven Zod 4 Forms
```tsx
import { z } from 'zod';
import { Form, FormField, FormError, Input, Select, SubmitButton } from 'ai-ui';

const schema = z.object({
  username: z.string().min(3),
  role: z.enum(['admin', 'member']),
});

<Form schema={schema} onSubmit={(data) => console.log(data)}>
  <FormField name="username" label="Username">
    <Input />
  </FormField>
  <FormField name="role" label="Role">
    <Select options={[{ label: 'Admin', value: 'admin' }, { label: 'Member', value: 'member' }]} />
  </FormField>
  <SubmitButton>Save User</SubmitButton>
</Form>
```

## 4. Theme System
All component surfaces consume HSV-calculated CSS variables (`--ai-bg-primary`, `--ai-bg-surface`, `--ai-color-primary`, `--ai-border`, `--ai-focus-ring`). Do not hardcode hex colors or inline pixel paddings; use `rem` units or theme parameters.
```
