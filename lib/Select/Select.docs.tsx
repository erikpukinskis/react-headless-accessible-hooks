import { styled } from "@stitches/react"
import { Doc, Demo } from "codedocs"
import { kebabCase } from "lodash"
import React, { useMemo, useState } from "react"
import { useSelect } from "./useSelect"

export default (
  <Doc path="/Docs/Select">
    <p>A menu from which you choose a single item and then closes.</p>

    <p>
      This hook helps with keyboard navigation, but does not do any positioning
      as a popover. We recommend the excellent{" "}
      <a href="https://www.react-laag.com/">react-laag</a> library for
      positioning popovers.
    </p>

    <h2>Features</h2>
    <ul>
      <li>Navigate menu with arrow keys or Page Up/Page Down</li>
      <li>Enter to select</li>
      <li>Open on focus</li>
    </ul>
  </Doc>
)

const SelectItem = styled("div", {
  paddingBlock: 4,
  paddingInline: 8,
  cursor: "pointer",

  variants: {
    highlighted: {
      true: {
        background: "#eee",
      },
    },
  },
})

type TemplateProps = {
  minQueryLength: number
  closeOnSelect?: boolean
}

// Items can be any type. You just need to provide a getOptionId function
// that can return a unique string id for each option.
const ITEMS = [
  { id: "one", label: "First Item" },
  { id: "two", label: "Second Item" },
  { id: "three", label: "Third Item" },
  { id: "four", label: "Fourth Item" },
]

function Template({ minQueryLength, closeOnSelect = true }: TemplateProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>()

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
    onSelect: (item, { close }) => {
      setSelectedId(item.id)

      if (closeOnSelect) close()
    },
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
      <br />
      Selected: {selectedId ?? "none"}
      {isExpanded && (
        <div {...getListboxProps()}>
          {matchingItems.map((item) => (
            <SelectItem
              key={item.id}
              {...getOptionProps(item)}
              highlighted={isHighlighted(item)}
            >
              {item.label}
            </SelectItem>
          ))}
        </div>
      )}
    </div>
  )
}

export const BasicSelect = (
  <Demo render={Template} props={{ minQueryLength: 1 }} />
)

export const OpenOnFocus = (
  <Demo render={Template} props={{ minQueryLength: 0 }} />
)

export const StaysOpenOnSelect = (
  <Demo render={Template} props={{ minQueryLength: 0, closeOnSelect: false }} />
)

export const BlurableInput = (
  <Demo render={BlurableDemoComponent} props={{ closeOnSelect: true }} />
)

export const BlurableInputAndMenuStaysOpen = (
  <Demo render={BlurableDemoComponent} props={{ closeOnSelect: false }} />
)

function BlurableDemoComponent({ closeOnSelect }: { closeOnSelect: boolean }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState("")
  const [editing, setEditing] = useState(-1)

  const [data, setData] = useState([
    "Lithium-burning",
    "Carbon-burning",
    "Neon-burning",
    "Oxygen-burning",
  ])

  const {
    getInputProps,
    getListboxProps,
    getOptionProps,
    isHighlighted,
    isExpanded,
  } = useSelect({
    data,
    label: "Items",
    getOptionValue: (item) => item,
    onSelect: (value, { close }) => {
      setSelected(value)

      if (closeOnSelect) close()
    },
  })

  const toggleEditing = (index: number) => () => {
    if (editing === index) {
      setEditing(-1)
    } else {
      setEditing(index)
    }
  }

  const updateStarType = (index: number) => (event: React.ChangeEvent) => {
    const newData = [...data]
    newData[index] = (event.target as HTMLInputElement).value
    setData(newData)
  }

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
      <br />
      Selected: {selected ?? "none"}
      {isExpanded && (
        <div {...getListboxProps()}>
          {data.map((starType, index) => (
            <SelectItem
              key={index}
              {...getOptionProps(starType)}
              highlighted={isHighlighted(starType)}
            >
              {editing === index ? (
                <input
                  type="text"
                  value={starType}
                  onChange={updateStarType(index)}
                />
              ) : (
                starType
              )}{" "}
              <button onClick={toggleEditing(index)}>edit</button>
            </SelectItem>
          ))}
        </div>
      )}
    </div>
  )
}
