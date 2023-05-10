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
  </Doc>
)

const SelectItem = styled("div", {
  paddingBlock: 4,
  paddingInline: 8,

  variants: {
    highlighted: {
      true: {
        background: "#eee",
      },
    },
  },
})

export const BasicSelect = (
  <Demo
    render={() => {
      // Items can be any type. You just need to provide a getOptionId function
      // that can return a unique string id for each option.
      const [items] = useState([
        { id: "one", label: "First Item" },
        { id: "two", label: "Second Item" },
        { id: "three", label: "Third Item" },
      ])

      const {
        getInputProps,
        getListboxProps,
        getOptionProps,
        highlightedIndex,
        isExpanded,
        query,
      } = useSelect(items, {
        label: "Demo Select",
        getOptionId: (item) => item.id,
        minQueryLength: 0,
      })

      const matchingItems = useMemo(() => {
        if (!query.trim()) return items

        return items.filter((item) =>
          kebabCase(item.label).includes(kebabCase(query))
        )
      }, [items, query])

      return (
        <div>
          <input type="text" placeholder="Search..." {...getInputProps()} />
          {isExpanded && (
            <div {...getListboxProps()}>
              {matchingItems.map((item, index) => (
                <SelectItem
                  key={item.id}
                  {...getOptionProps(index)}
                  highlighted={index === highlightedIndex}
                >
                  {item.label}
                </SelectItem>
              ))}
            </div>
          )}
        </div>
      )
    }}
  />
)
