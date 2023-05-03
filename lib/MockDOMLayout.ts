import type React from "react"
import type { SpyInstance } from "vitest"
import { vi } from "vitest"
import { describeElement } from "./describeElement"
import { mockDOMRect } from "./mockDOMRect"
import { MockResizeObserver } from "./MockResizeObserver"
import type { PartialResizeObserverEntry } from "./mockResizeObserverEntry"

/**
 * Helper for mocking getBoundingClientRect in various conditions
 */
export class MockDOMLayout {
  private getBoundingClientRectSpy?: SpyInstance
  private mocksByRole: Partial<Record<React.AriaRole, DOMRect>> = {}
  private elementMocks: SpyInstance[] = []
  private originalResizeObserverConstructor: typeof ResizeObserver
  private resizeObservers: MockResizeObserver[] = []

  /**
   * Restore anything elements mocked by this MockDOMLayout, and clear all resize observers
   */
  cleanup: (this: void) => void
  /**
   * Restore all mocks
   */
  destroy: (this: void) => void

  /**
   * Mocks the global ResizeObserver constructor so that it returns a mock
   * ResizeObserver that will call your callback when you call
   * layout.resize(element, rect) below.
   */
  constructor() {
    this.originalResizeObserverConstructor = global.ResizeObserver

    this.cleanup = () => {
      this.restoreElementMocks()
      this.clearObservers()
    }

    this.destroy = () => {
      this.restoreElementMocks()
      this.clearObservers()
      this.restoreResizeObseverMock()
    }

    const disconnect = (observer: MockResizeObserver) => {
      const index = this.resizeObservers.findIndex((ob) => ob === observer)
      this.resizeObservers.splice(index, 1)
    }

    global.ResizeObserver = vi
      .fn()
      .mockImplementation(
        (callback: ResizeObserverCallback): ResizeObserver => {
          const observer = new MockResizeObserver(callback, disconnect)
          this.resizeObservers.push(observer)
          return observer
        }
      )
  }

  private restoreElementMocks() {
    this.getBoundingClientRectSpy?.mockRestore()

    delete this.getBoundingClientRectSpy

    for (const mock of this.elementMocks) {
      mock.mockRestore()
    }

    this.elementMocks = []
  }

  private clearObservers() {
    this.resizeObservers = []
  }

  private restoreResizeObseverMock() {
    global.ResizeObserver = this.originalResizeObserverConstructor
  }

  private getBoundingClientRect(element: Element) {
    const role = element.getAttribute("role")
    const roleRect = role && this.mocksByRole[role]

    if (roleRect) return roleRect

    return mockDOMRect({})
  }

  /**
   * Mock the DOMRect on a single DOM node
   */
  mockElementBoundingRect(element: Element, rect: Partial<DOMRect>) {
    const mock = vi
      .spyOn(element, "getBoundingClientRect")
      .mockImplementation(function mockGetBoundingClientRectForElement() {
        return mockDOMRect(rect)
      })

    this.elementMocks.push(mock)
  }

  /**
   * Mock the DOMRects on a list of elements. For example, if you would like the
   * first element to have the attributes:
   *
   *     left: 100
   *     top: 100
   *     width: 200
   *     height: 20
   *
   * and the gap between elements is 10, then the second element will DOMRect
   * will get top: 125, the third will get top: 150, fourth 175, etc.
   */
  mockListBoundingRects(
    elements: Element[],
    firstRect: {
      left?: number
      top?: number
      width: number
      height: number
      gap?: number
    }
  ) {
    const { left = 0, top = 0, width, height, gap = 0 } = firstRect

    let y = top
    for (const element of elements) {
      this.mockElementBoundingRect(element, {
        width,
        height,
        top: y,
        bottom: y + height,
        left: left,
      })

      const isAbsolutePositioned =
        element instanceof HTMLElement && element.style.position !== "absolute"

      if (!isAbsolutePositioned) {
        y += height + gap
      }
    }
  }

  /**
   * Mock the DOMRects of every element with a given role
   */
  mockRoleBoundingRects(role: string, rect: Partial<DOMRect>) {
    this.mocksByRole[role] = mockDOMRect(rect)

    if (this.getBoundingClientRectSpy) return

    const layout = this

    this.getBoundingClientRectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function mockGetBoundingClientRectForRole(
        this: Element
      ) {
        const element = this
        return layout.getBoundingClientRect(element)
      })
  }

  resize(target: Element, entry: PartialResizeObserverEntry) {
    if (!global.ResizeObserver) {
      throw new Error(
        "Tried to fire a resize event after MockDomLayout had already been destroyed"
      )
    }

    const observersThatFired = this.resizeObservers.filter((observer) => {
      return observer.resize(target, [entry])
    })

    if (observersThatFired.length < 1) {
      throw new Error(
        `Tried to fire a resize on element ${describeElement(
          target
        )} but no observers were observing it`
      )
    }
  }
}
