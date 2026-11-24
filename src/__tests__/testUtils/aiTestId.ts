// The toolkit's own test hooks use `data-ai-testid`, never `data-testid`: that
// name belongs to the consumer (it's what Testing Library's getByTestId looks
// for by default), so toolcrib never sets it. These mirror getByTestId and
// friends for the reserved attribute.

const selector = (id: string) => `[data-ai-testid="${id}"]`;

/** Every element carrying `data-ai-testid="<id>"`, in document order. */
export function queryAllAi(id: string, root: HTMLElement = document.body): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector(id)));
}

/** The one element carrying `data-ai-testid="<id>"`, or null. Throws if there are several. */
export function queryAi(id: string, root: HTMLElement = document.body): HTMLElement | null {
  const all = queryAllAi(id, root);
  if (all.length > 1) throw new Error(`Found ${all.length} elements with data-ai-testid="${id}"`);
  return all[0] ?? null;
}

/** Like getAllByTestId: throws when none match. */
export function getAllAi(id: string, root: HTMLElement = document.body): HTMLElement[] {
  const all = queryAllAi(id, root);
  if (all.length === 0) throw new Error(`Unable to find an element with data-ai-testid="${id}"`);
  return all;
}

/** Like getByTestId: throws when none or several match. */
export function getAi(id: string, root: HTMLElement = document.body): HTMLElement {
  const el = queryAi(id, root);
  if (!el) throw new Error(`Unable to find an element with data-ai-testid="${id}"`);
  return el;
}
