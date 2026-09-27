// Checks generate-demo-sources.js's comment stripping (#678) on a fixture.
// Plain node + assert, run by src/__tests__/docsInSync.test.ts as a
// subprocess (the same reason that file shells out to the generators).
import assert from 'node:assert/strict';
import { extractDemoSources } from './generate-demo-sources.js';

const fixture = `
const componentDemos = {
  Demo: (
    <VStack gap="md">
      {/* A note to maintainers: this JSX comment must go. */}
      <Text>See https://example.com // not a comment: JSX text</Text>
      <Button
        // a line comment on an attribute
        onClick={() => save() /* trailing block comment */}
      >
        Save
      </Button>
      {items.map(i => (
        // explains the map
        <Item key={i} />
      ))}
      {load()
        // before a chained call
        .catch(() => {})}
    </VStack>
  ),
};
const systemAreas = [];
`;

const { components } = extractDemoSources(fixture);
const demo = components.Demo;

assert.ok(!/\/\/ a line comment|\/\/ explains|\/\/ before a chained/.test(demo), 'line comments are removed');
assert.ok(!demo.includes('/*'), 'block and JSX comments are removed');
assert.ok(demo.includes('See https://example.com // not a comment: JSX text'), 'JSX text keeps its // content');
assert.ok(demo.includes('onClick={() => save()}'), 'code around a removed trailing comment is kept');
assert.ok(demo.includes('.catch(() => {})'), 'a chained call after a removed comment is kept');
assert.ok(!demo.split('\n').some(l => l.trim() === '' ), 'lines emptied by a removal are dropped');
assert.equal(
  demo,
  [
    '<VStack gap="md">',
    '  <Text>See https://example.com // not a comment: JSX text</Text>',
    '  <Button',
    '    onClick={() => save()}',
    '  >',
    '    Save',
    '  </Button>',
    '  {items.map(i => (',
    '    <Item key={i} />',
    '  ))}',
    '  {load()',
    '    .catch(() => {})}',
    '</VStack>',
  ].join('\n')
);

console.log('demo-sources comment stripping: all checks passed');
