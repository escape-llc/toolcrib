import { z, type ZodType } from 'zod';

/**
 * Builds a "does not really validate anything" schema from one sample
 * record's own runtime shape -- the mandatory-`editSchema` requirement's
 * escape hatch for a consumer who genuinely doesn't care about validation
 * and just wants every editable column rendered as a plain text box (issue
 * #545). Deliberately the REVERSE of a schema-to-component mapping (which
 * `<DataTable editEditor>` deferred entirely, per that issue) -- this only
 * ever inspects a JS value's `typeof`, never a Zod type's own internals, so
 * it carries none of that idea's scope/risk.
 *
 * `null`/`undefined` fields fall back to `z.any()` -- there's no sample
 * value to infer a real type from, and refusing to build a schema at all
 * over one absent field would defeat the entire point of a "just accept
 * anything" helper.
 *
 * @barrelExport
 */
export function createPermissiveTableSchema<T extends Record<string, any>>(sample: T): ZodType<T> {
  const shape: Record<string, ZodType<any>> = {};
  for (const key of Object.keys(sample)) {
    const value = sample[key];
    switch (typeof value) {
      case 'string':
        shape[key] = z.string();
        break;
      case 'number':
        shape[key] = z.number();
        break;
      case 'boolean':
        shape[key] = z.boolean();
        break;
      default:
        shape[key] = z.any();
    }
  }
  return z.object(shape) as unknown as ZodType<T>;
}
