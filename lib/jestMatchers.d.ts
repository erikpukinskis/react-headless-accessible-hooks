import type { CSSProperties } from "react"

export {}

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveComputedStyle: (expected: CSSProperties) => R
    }
  }
}
