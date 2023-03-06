import { describe, expect, it } from "vitest"
import { OrderableListModel } from "./OrderableListModel"
import { mockDomRect } from "~/testHelpers"

describe("OrderableListModel", () => {
  it("detects when a rect is over an item", () => {
    const list = new OrderableListModel()

    const draggingRect = mockDomRect({
      top: 0,
      left: 0,
      width: 200,
      height: 20,
    })
    const overRect = mockDomRect({ top: 20, left: 0, width: 200, height: 20 })

    list.setRect(0, draggingRect)
    list.setRect(0, overRect)

    expect(
      isOver({
        mousedown: mockMouseEvent({ clientX, clientY, target }),
        mousemove: mockMouseEvent({ clientX, clientY, target }),
      })
    ).toBe(true)
  })
})
