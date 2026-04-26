// Deterministic-ish UUID mock for tests. Each call yields a unique value.
let counter = 0
function next() {
  counter += 1
  // Pad to look like a UUID (not real, but unique per call)
  const n = counter.toString(16).padStart(12, "0")
  return `00000000-0000-4000-8000-${n}`
}
module.exports = {
  v4: next,
  default: { v4: next },
}
