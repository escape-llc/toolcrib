# Worked Example: Event Bus Sticky Replay

`<TabStrip>` and `<TabStrip.Panel>` are the toolkit's clearest example of
why sticky events exist. They coordinate purely through `tab:changed` on
`aiBus`, matched by a shared `id`/`groupId` string — **they are not
required to share a DOM ancestor**, or even mount in the same part of the
tree. This file walks through the mount-order problem that creates, and
exactly how sticky replay solves it.

## The problem: two independent subtrees, no ordering guarantee

```tsx
import { TabStrip, TabStrip as TS, AppShell } from '#toolcrib';

<AppShell>
  <AppShell.Header>
    <TabStrip id="settings-tabs" items={tabs} defaultActiveId="general" />
  </AppShell.Header>
  <AppShell.Main>
    {/* Rendered in a completely different part of the layout — no shared
        parent with the TabStrip above other than AppShell itself, and
        AppShell never passes activeId down to either one. */}
    <TabStrip.Panel groupId="settings-tabs" value="general">
      General settings content.
    </TabStrip.Panel>
  </AppShell.Main>
</AppShell>
```

`<TabStrip>` broadcasts `tab:changed` once on mount (with its initial
`activeId`) and again on every user click — it never reads panels back, so
there's no prop-drilling of "which tab is active" in either direction.
That's the point of using the bus here at all. But it also means: if
`<TabStrip.Panel>` happens to mount and call `aiBus.on('tab:changed', ...)`
*after* `<TabStrip>` already broadcast its mount-time event, a plain
publish/subscribe bus would have already dropped that event — nobody was
listening yet — and the panel would stay permanently blank until the user
actually clicks a tab.

## The fix: sticky replay

`tab:changed` is registered as a sticky channel in `eventBus.ts`'s
`STICKY_EVENTS` set. A sticky channel's bus remembers the last payload
broadcast for each distinct `id`, and replays it — synchronously, before
any future event — to a new subscriber the moment it calls `on()`. So a
`<TabStrip.Panel>` that mounts late still receives the current
`tab:changed` state immediately, as if it had been listening the whole
time. The channel's exact payload shape (this is what gets replayed) is:

```ts
{ id?: string; activeId: string; previousId?: string }
```

`id` is what makes replay scoped correctly when more than one
`<TabStrip>` exists on a page at once: the bus remembers the last payload
*per distinct `id`* and replays all of them to a new subscriber, which
then filters to the one it cares about via `event.id === groupId` — the
same pattern `TabPanel`'s own implementation uses internally.

## When this matters vs. when it doesn't

This is specifically a **cross-tree, no-shared-ancestor** concern. A
component reading state from its own direct parent via React Context
(e.g. `<SubmitButton>` reading `isSubmitting` from its ancestor `<Form>`)
never has this problem — mount order within a single render tree is
already deterministic parent-before-child. Sticky replay only matters
for the event-bus case: two components with no direct-tree relationship,
where either one could plausibly mount first.
