/**
 * Minimal evaluator for the Mongo-style filter documents produced by
 * `buildVisitorFilter`. Lets the API test suite run the *real* filter against
 * plain JS objects — no MongoDB, no production data.
 */

function toComparable(value) {
  if (value instanceof Date) return value.getTime();
  return value;
}

function looseEq(value, expected) {
  if (value instanceof Date || expected instanceof Date) {
    const a = value instanceof Date ? value.getTime() : new Date(value).getTime();
    const b = expected instanceof Date ? expected.getTime() : new Date(expected).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return a === b;
  }
  if (value === undefined || value === null) return expected === null || expected === undefined;
  if (expected === null || expected === undefined) return false;
  if (typeof value === "number" && typeof expected === "number") return value === expected;
  return String(value) === String(expected);
}

function compare(value, expected) {
  const a = toComparable(value);
  const b = toComparable(expected);
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return at === bt ? 0 : at < bt ? -1 : 1;
  }
  if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
  const as = String(a ?? "");
  const bs = String(b ?? "");
  return as === bs ? 0 : as < bs ? -1 : 1;
}

function isOperatorObject(cond) {
  return (
    cond !== null &&
    typeof cond === "object" &&
    !(cond instanceof Date) &&
    !Array.isArray(cond) &&
    Object.keys(cond).some((k) => k.startsWith("$"))
  );
}

function matchesCondition(value, cond) {
  if (!isOperatorObject(cond)) return looseEq(value, cond);

  return Object.entries(cond).every(([op, arg]) => {
    switch (op) {
      case "$regex": {
        const flags = String(cond.$options || "").replace(/[^gimsuy]/g, "");
        const rx = new RegExp(arg, flags);
        return rx.test(value === undefined || value === null ? "" : String(value));
      }
      case "$options":
        return true;
      case "$gte":
        return compare(value, arg) >= 0;
      case "$gt":
        return compare(value, arg) > 0;
      case "$lte":
        return compare(value, arg) <= 0;
      case "$lt":
        return compare(value, arg) < 0;
      case "$in":
        return (arg || []).some((a) => looseEq(value, a));
      case "$ne":
        return !looseEq(value, arg);
      default:
        throw new Error(`unsupported operator in test filter: ${op}`);
    }
  });
}

export function matchesFilter(doc, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((c) => matchesFilter(doc, c));
    if (key === "$and") return cond.every((c) => matchesFilter(doc, c));
    return matchesCondition(doc[key], cond);
  });
}
