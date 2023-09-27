/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { render, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { kebabCase } from "lodash"
import { useMemo, useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { useSelect } from "./useSelect"

const user = userEvent.setup()

const expectCloseHandler = expect.objectContaining({
  close: expect.any(Function),
})

describe("Select", () => {
  afterEach(cleanup)

  it("returns an item when you navigate to it via search and arrow keys", async () => {
    const onSelect = vi.fn()

    const { getByRole } = render(
      <Template minQueryLength={1} onSelect={onSelect} />
    )

    const input = getByRole("combobox")

    await user.click(input)
    await user.keyboard("f")
    await user.keyboard("{ArrowDown}")
    await user.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith(ITEMS[3], expectCloseHandler)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "four",
      }),
      expectCloseHandler
    )
  })

  it("expands when you change the query", async () => {
    const onSelect = vi.fn()

    const { getByRole, getAllByRole } = render(
      <Template minQueryLength={1} onSelect={onSelect} />
    )

    const input = getByRole("combobox")

    await user.click(input)
    await user.keyboard("f")
    await user.keyboard("{Enter}")
    await user.keyboard("o")

    const options = getAllByRole("option")

    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Fourth Item")
  })
})

type Item = { id: string; label: string }

const ITEMS: Item[] = [
  { id: "one", label: "First Item" },
  { id: "two", label: "Second Item" },
  { id: "three", label: "Third Item" },
  { id: "four", label: "Fourth Item" },
]

type TemplateProps = {
  minQueryLength: number
  onSelect(id: Item): void
}

function Template({ minQueryLength, onSelect }: TemplateProps) {
  const [query, setQuery] = useState("")

  const matchingItems = useMemo(() => {
    const q = query.trim()

    if (q.length < minQueryLength) return []

    if (!q) return ITEMS

    return ITEMS.filter((item) =>
      kebabCase(item.label).includes(kebabCase(query))
    )
  }, [minQueryLength, query])

  const {
    getInputProps,
    getListboxProps,
    getOptionProps,
    isHighlighted,
    isExpanded,
  } = useSelect({
    data: matchingItems,
    label: "Items",
    getOptionValue: (item) => item.id,
    onSelect,
  })

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search items"
        {...getInputProps()}
      />
      {isExpanded && (
        <div {...getListboxProps()}>
          {matchingItems.map((item) => (
            <div
              key={item.id}
              {...getOptionProps(item)}
              style={{ color: isHighlighted(item) ? "gray" : "white" }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
