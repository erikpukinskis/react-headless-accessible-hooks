import type React from "react"
import type { SpyInstance } from "vitest"
import { vi } from "vitest"

/**
 * Helper for mocking getBoundingClientRect in various conditions
 */
export class MockDOMLayout {
  private getBoundingClientRectSpy?: SpyInstance
  private mocksByRole: Partial<Record<React.AriaRole, DOMRect>> = {}
  private elementMocks: SpyInstance[] = []

  /**
   * Restore anything mocked by this MockDOMLayout
   */
  cleanup: (this: void) => void

  constructor() {
    this.cleanup = this.restoreMocks.bind(this)
  }

  private restoreMocks() {
    this.getBoundingClientRectSpy?.mockRestore()

    delete this.getBoundingClientRectSpy

    for (const mock of this.elementMocks) {
      mock.mockRestore()
    }

    this.elementMocks = []
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
}

function mockDOMRect(overrides: Partial<DOMRect>) {
  return new Proxy({} as DOMRect, {
    get(_, prop: keyof DOMRect) {
      if (prop in overrides) return overrides[prop]
      throw new Error(
        `${prop} not implemented in your mockDomRect. Try mockDomRect({ ${prop}: ... })`
      )
    },
  })
}
