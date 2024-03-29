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
}

// Items can be any type. You just need to provide a getOptionId function
// that can return a unique string id for each option.
const ITEMS = [
  { id: "one", label: "First Item" },
  { id: "two", label: "Second Item" },
  { id: "three", label: "Third Item" },
  { id: "four", label: "Fourth Item" },
]

function Template({ minQueryLength }: TemplateProps) {
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
    onSelect: (item) => {
      setSelectedId(item.id)
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

export const Blurable = (
  <Demo
    render={() => {
      const [query, setQuery] = useState("")
      const [selected, setSelected] = useState("")
      const [previewed, setPreviewed] = useState("")

      const data = [
        "Lithium-burning",
        "Carbon-burning",
        "Neon-burning",
        "Oxygen-burning",
      ]

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
        onSelect: (value) => {
          setSelected(value)
        },
      })

      const handleStarClick =
        (starType: string) => (event: React.MouseEvent) => {
          event.stopPropagation()
          setPreviewed(starType)
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
          <br />
          Previewed: {previewed ?? "none"}
          {isExpanded && (
            <div {...getListboxProps()}>
              {data.map((starType) => (
                <SelectItem
                  key={starType}
                  {...getOptionProps(starType)}
                  highlighted={isHighlighted(starType)}
                >
                  {starType}{" "}
                  <button onClick={handleStarClick(starType)}>preview</button>
                </SelectItem>
              ))}
            </div>
          )}
        </div>
      )
    }}
  />
)
