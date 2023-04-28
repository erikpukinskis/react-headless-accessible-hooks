import type { PartialResizeObserverEntry } from "./mockResizeObserverEntry"
import { mockResizeObserverEntry } from "./mockResizeObserverEntry"

export class MockResizeObserver implements ResizeObserver {
  private resizeCallbacksByElementIndex: Record<
    number,
    ResizeObserverCallback[]
  > = {}

  private observedElements: (Element | null)[] = []
  private callback: ResizeObserverCallback
  private connected = true

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    if (this.observedElements.includes(target)) {
      // See note below about being liberal throwing errors
      throw new Error("Already observing element")
    }

    // We keep track of elements by index. On observe we add the observed
    // element to our list. Then when we fire a layout.resize event on a given
    // element in our test, we look up that element in our index, and use that
    // to find any resize callbacks that need to be called.
    const index = this.observedElements.push(target) - 1

    let callbacks = this.resizeCallbacksByElementIndex[index]

    if (!callbacks) {
      callbacks = this.resizeCallbacksByElementIndex[index] = []
    }

    callbacks.push(this.callback)
  }

  unobserve(target: Element) {
    const elementIndex = this.observedElements.findIndex((el) => el === target)

    if (!elementIndex) {
      // We are more more liberal throwing errors than a normal ResizeObserver
      // is, because we want to hold the tests to a higher standard of behavior.
      // Ideally your application should not be unobserving elements that aren't
      // being observed. Although this decision may need to be revisited in the
      // future if it turns out to be annoying.
      throw new Error(
        "Tried to unobserve an element that wasn't being observed by any ResizeObservers"
      )
    }

    const callbacks = this.resizeCallbacksByElementIndex[elementIndex]

    const callbackIndex = callbacks.findIndex((fn) => fn === this.callback)

    if (callbackIndex < 0) {
      throw new Error(
        "Tried to unobserve an element in a ResizeObserver that wasn't observering it"
      )
    }

    callbacks.splice(callbackIndex, 1)
  }

  disconnect() {
    this.connected = false
  }

  resize(target: Element, entries: PartialResizeObserverEntry[]) {
    if (!this.connected) return false

    const index = this.observedElements.findIndex((el) => el === target)

    if (index < 0) return false

    this.callback(
      entries.map((overrides) => {
        return mockResizeObserverEntry({ target, ...overrides })
      }),
      this
    )

    return true
  }
}
