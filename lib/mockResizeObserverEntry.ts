import { mockDOMRect } from "./mockDOMRect"

export type PartialResizeObserverEntry = Partial<{
  borderBoxSize: Array<ResizeObserverSize>
  contentBoxSize: Array<ResizeObserverSize>
  contentRect: Partial<DOMRect>
  devicePixelContentBoxSize: Array<ResizeObserverSize>
  target: Element
}>

export function mockResizeObserverEntry(overrides: PartialResizeObserverEntry) {
  return new Proxy({} as ResizeObserverEntry, {
    get(_, prop: keyof ResizeObserverEntry) {
      if (prop === "contentRect" && overrides.contentRect) {
        return mockDOMRect(overrides.contentRect)
      }

      if (prop in overrides) return overrides[prop]

      throw new Error(
        `${prop} not implemented in your mockResizeObserverEntry. Try mockResizeObserverEntry({ ${prop}: ... })`
      )
    },
  })
}
