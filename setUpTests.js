import matchers from "@testing-library/jest-dom/matchers"
import { expect } from "vitest"

// We don't want any pseudo-errors to slip through. Stuff like "Can't perform a
// React state update on an unmounted component"
console.error = function () {
  let [message, ...substitutions] = Array.from(arguments)

  for (const substitution of substitutions) {
    message = message.replace("%s", substitution)
  }

  throw new Error(message)
}

expect.extend(matchers)

expect.extend({
  toHaveComputedStyle(element, styles) {
    const { isNot } = this

    if (!(element instanceof HTMLElement)) {
      return {
        pass: false,
        message: () =>
          `${element} does not have styles because it is not an HTMLElement`,
      }
    }

    const computed = window.getComputedStyle(element)

    for (const [property, expectedValue] of Object.entries(styles)) {
      const actualString = computed[property]

      const expectedString =
        typeof expectedValue === "number" ? `${expectedValue}px` : expectedValue

      if (actualString === expectedString) continue

      return {
        pass: false,
        message: () =>
          isNot
            ? `CSS property ${property} was not expected to be ${JSON.stringify(
                expectedValue
              )} but it was`
            : `CSS property ${property} was expected to be ${JSON.stringify(
                expectedValue
              )} but it was ${JSON.stringify(actualString)}`,
      }
    }

    return {
      pass: true,
    }
  },
})
