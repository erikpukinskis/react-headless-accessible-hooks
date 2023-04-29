import { describeElement } from "./describeElement"
import type { PartialResizeObserverEntry } from "./mockResizeObserverEntry"
import { mockResizeObserverEntry } from "./mockResizeObserverEntry"

export class MockResizeObserver implements ResizeObserver {
  private observedElements: (Element | null)[] = []
  private callback: ResizeObserverCallback
  private connected = true
  private onDisconnect: (observer: MockResizeObserver) => void

  constructor(
    callback: ResizeObserverCallback,
    onDisconnect: (observer: MockResizeObserver) => void
  ) {
    this.callback = callback
    this.onDisconnect = onDisconnect
  }

  observe(target: Element) {
    if (!this.connected) {
      throw new Error(
        `Tried to use disconnected ResizeObserver to observe ${describeElement(
          target
        )}`
      )
    }

    if (this.observedElements.includes(target)) {
      // See note below about being "more liberal throwing errors"
      throw new Error(`Already observing ${describeElement(target)}`)
    }

    this.observedElements.push(target)
  }

  unobserve(target: Element) {
    if (!this.connected) {
      throw new Error(
        `Tried to use disconnected ResizeObserver to unobserve ${describeElement(
          target
        )}`
      )
    }

    const elementIndex = this.observedElements.findIndex((el) => el === target)

    if (elementIndex < 0) {
      // We are more liberal throwing errors than a normal ResizeObserver is,
      // because we want to hold the tests to a higher standard of behavior.
      // Ideally your application should not be unobserving elements that aren't
      // being observed. Although this decision may need to be revisited in the
      // future if it turns out to be annoying.
      throw new Error(
        `Tried to unobserve ${describeElement(
          target
        )} but it wasn't being observed by any ResizeObservers`
      )
    }
    this.observedElements.splice(elementIndex, 1)
  }

  disconnect() {
    this.connected = false
    this.onDisconnect(this)
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
