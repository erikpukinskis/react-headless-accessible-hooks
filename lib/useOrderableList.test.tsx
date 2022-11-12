import { render, fireEvent, cleanup } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useOrderableList } from "~/index"
import { mockDomRect } from "~/testHelpers"

const USERS = [
  {
    id: "1",
    handle: "@yvonnezlam",
  },
  {
    id: "2",
    handle: "@rsms",
  },
  {
    id: "3",
    handle: "@pavelasamsonov",
  },
]

const mockDomRects = (elements: HTMLElement[]) => {
  const [yvonnezlam, rsms, pavelasamsonov] = elements

  vi.spyOn(yvonnezlam, "getBoundingClientRect").mockReturnValue(
    mockDomRect({
      width: 200,
      height: 20,
      top: 0,
      bottom: 20,
    })
  )

  vi.spyOn(rsms, "getBoundingClientRect").mockReturnValue(
    mockDomRect({
      width: 200,
      height: 20,
      top: 20,
      bottom: 40,
    })
  )

  vi.spyOn(pavelasamsonov, "getBoundingClientRect").mockReturnValue(
    mockDomRect({
      width: 200,
      height: 20,
      top: 40,
      bottom: 60,
    })
  )
}

describe("useOrderableList", () => {
  const onClick = vi.fn()

  const List = () => {
    const { getItemProps, items, isPlaceholder } = useOrderableList(USERS)

    return (
      <ul>
        {items.map((item, index) =>
          isPlaceholder(item) ? (
            <li key={item.key} {...getItemProps(index)}>
              Placeholder
            </li>
          ) : (
            <li key={item.id} onClick={onClick} {...getItemProps(index)}>
              {item.handle}
            </li>
          )
        )}
      </ul>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("example render without errors", () => {
    render(<List />)
  })

  it("example should show the first one first", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    expect(items[0].innerHTML).toEqual("@yvonnezlam")
    expect(items).toHaveLength(3)
  })

  it("should fire a click event if we mousedown without dragging", () => {
    const { getAllByRole } = render(<List />)

    const [first] = getAllByRole("listitem")

    fireEvent.mouseEnter(first, {
      clientX: 0,
      clientY: 0,
    })

    fireEvent.mouseDown(first, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseUp(first, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.click(first, {
      clientX: 10,
      clientY: 10,
    })

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("should pop the element out and add a placeholder if we drag", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    mockDomRects(items)

    const [yvonnezlam] = items
    const dragElement = yvonnezlam

    fireEvent.mouseDown(dragElement, {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseMove(dragElement, {
      clientX: 20,
      clientY: 20,
    })

    // Should detatch the item and size it
    expect(dragElement.style.position).toBe("absolute")
    expect(dragElement.style.transform).toBe("translate(10px, 10px)")
    expect(toNumber(dragElement.style.width)).toBeGreaterThan(0)
    expect(toNumber(dragElement.style.height)).toBeGreaterThan(0)

    const dragStartItems = getAllByRole("listitem")

    // Should insert the Placeholder into the list and size it
    expect(dragStartItems).toHaveLength(4)
    const [placeholder, first] = dragStartItems
    expect(placeholder.innerHTML).toEqual("Placeholder")
    expect(first.innerHTML).toEqual("@yvonnezlam")
    expect(toNumber(placeholder.style.width)).toBeGreaterThan(0)
    expect(toNumber(placeholder.style.height)).toBeGreaterThan(0)

    // Finish drag
    fireEvent.mouseUp(dragElement, {
      clientX: 20,
      clientY: 20,
    })

    expect(onClick).not.toHaveBeenCalled()
  })

  it("should swap the placeholder in for items when we drag it halfway down into items", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    mockDomRects(items)

    const [yvonnezlam] = items
    const dragElement = yvonnezlam

    fireEvent.mouseDown(dragElement, {
      clientX: 10,
      clientY: 5,
    })

    // Start the drag
    fireEvent.mouseMove(dragElement, {
      clientX: 10,
      clientY: 10,
    })

    const dragStartItems = getAllByRole("listitem")

    // Expect placeholder to have been added
    expect(dragStartItems).toHaveLength(4)
    expect(dragStartItems[0].innerHTML).toBe("Placeholder")
    expect(dragStartItems[1].innerHTML).toBe("@yvonnezlam")
    expect(dragStartItems[2].innerHTML).toBe("@rsms")

    // First drag down exactly 9 pixels
    fireEvent.mouseMove(dragElement, {
      clientX: 10,
      clientY: 14,
      bubbles: true,
    })

    const itemsAfter9px = getAllByRole("listitem")

    // Since we will only be 9 pixels (less than halfway) into the second item,
    // expect that the order is still the same
    expect(itemsAfter9px[0].innerHTML).toBe("@yvonnezlam")
    expect(itemsAfter9px[1].innerHTML).toBe("Placeholder")
    expect(itemsAfter9px[2].innerHTML).toBe("@rsms")

    // Now drag two more pixels, so that the dragging item is 50% into the
    // second item
    fireEvent.mouseMove(dragElement, {
      clientX: 10,
      clientY: 16,
      bubbles: true,
    })

    const itemsPastHalfway = getAllByRole("listitem")

    // Now we expect the second item to have moved up and the placeholder to be
    // one position further down
    expect(itemsPastHalfway[0].innerHTML).toBe("@yvonnezlam")
    expect(itemsPastHalfway[1].innerHTML).toBe("@rsms")
    expect(itemsPastHalfway[2].innerHTML).toBe("Placeholder")
  })

  it("should swap the placeholder in for items when we drag it halfway UP into items", () => {
    const { getAllByRole } = render(<List />)

    const items = getAllByRole("listitem")

    mockDomRects(items)

    const [_, rsms] = items
    const dragElement = rsms

    // Start the drag
    fireEvent.mouseDown(dragElement, {
      clientX: 10,
      clientY: 35,
    })

    fireEvent.mouseMove(dragElement, {
      clientX: 10,
      clientY: 30,
    })

    const dragStartItems = getAllByRole("listitem")

    // Expect placeholder to have been added
    expect(dragStartItems).toHaveLength(4)
    expect(dragStartItems[0].innerHTML).toBe("@yvonnezlam")
    expect(dragStartItems[1].innerHTML).toBe("Placeholder")
    expect(dragStartItems[2].innerHTML).toBe("@rsms")

    // Now drag past the halfway point
    fireEvent.mouseMove(dragElement, {
      clientX: 10,
      clientY: 24,
      bubbles: true,
    })

    const itemsPastHalfway = getAllByRole("listitem")

    // Expect the placeholder and first element to have been swapped
    expect(itemsPastHalfway).toHaveLength(4)
    expect(itemsPastHalfway[0].innerHTML).toBe("Placeholder")
    expect(itemsPastHalfway[1].innerHTML).toBe("@yvonnezlam")
    expect(itemsPastHalfway[2].innerHTML).toBe("@rsms")
  })
})

const toNumber = (str: string) => {
  return Number(str.replace(/[^0-9]/g, "") || undefined)
}
