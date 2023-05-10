import { useState, useEffect, useMemo } from "react"
import { useFocusGroup } from "~/FocusGroup"

type SelectOptions<ItemType> = {
  label: string
  onInputChange?: (value: string) => void
  getOptionId: (item: ItemType) => string
  onSelect?: (item: ItemType) => void
  minQueryLength?: number
}

export const useSelect = <ItemType>(
  items: ItemType[] | undefined,
  {
    label,
    onInputChange,
    getOptionId,
    onSelect,
    minQueryLength = 1,
  }: SelectOptions<ItemType>
) => {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [query, setQuery] = useState("")

  const { focusGroupProps, focus, blur } = useFocusGroup({
    onBlur: () => setHidden(true),
  })

  useEffect(
    function keepSelectionWithinResults() {
      console.log("item length changed!")
      setHighlightedIndex(-1)
    },
    [items?.length]
  )

  const activeDescendantId = useMemo(
    function updateActiveDescendant() {
      if (highlightedIndex === -1) return undefined
      if (!items) return undefined
      if (items.length < 1) return undefined
      return getOptionId(items[highlightedIndex])
    },
    [highlightedIndex, items, getOptionId]
  )

  const handleKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
    console.log("key", event.key, items?.length)
    if (event.key === "Escape") {
      setHidden(true)
      return
    }

    if (!items || items.length < 1) return

    if (
      event.key === "PageUp" ||
      (event.key === "ArrowLeft" && event.metaKey)
    ) {
      setHighlightedIndex(0)
      event.preventDefault()
    } else if (
      event.key === "PageDown" ||
      (event.key === "ArrowRight" && event.metaKey)
    ) {
      setHighlightedIndex(items.length - 1)
      event.preventDefault()
    } else if (event.key === "Enter") {
      event.preventDefault()
      const selectedItem = items[highlightedIndex]
      setHidden(true)
      blur("input")
      onSelect?.(selectedItem)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      if (highlightedIndex < 1) return
      setHighlightedIndex((index) => index - 1)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      console.log("down!", highlightedIndex)
      if (highlightedIndex >= items.length - 1) return
      setHighlightedIndex((index) => {
        console.log("was", index, "now", index + 1)
        return index + 1
      })
    }
  }

  console.log("rendering", highlightedIndex)

  const handleInputChange = (event: React.ChangeEvent) => {
    if (!(event.target instanceof HTMLInputElement)) {
      throw new Error(
        "useSelect input change target was not an HTMLInputElement?"
      )
    }
    setQuery(event.target.value)
    onInputChange?.(event.target.value)
    setHidden(false)
  }

  const handleResultClick = () => {
    setHidden(true)
    blur("input")
  }

  const isExpanded = (items: ItemType[] | undefined): items is ItemType[] => {
    return query.trim().length >= minQueryLength && Boolean(items) && !isHidden
  }

  return {
    query,
    isExpanded: isExpanded(items),
    highlightedIndex,
    getInputProps: () => ({
      ...focusGroupProps,
      "onChange": handleInputChange,
      "role": "combobox",
      "aria-expanded": isExpanded(items),
      "aria-activedescendant": activeDescendantId,
      "aria-label": label,
      "value": query,
      "onKeyDown": handleKeys,
    }),
    getListboxProps: () => ({
      "role": "listbox",
      "aria-label": label,
    }),
    getOptionProps: (index: number) => ({
      "role": "option",
      ...focusGroupProps,
      "onClick": handleResultClick,
      "onMouseOver": () => setHighlightedIndex(index),
      "aria-selected": highlightedIndex === index,
      "id": items ? getOptionId(items[index]) : undefined,
    }),
    focus: () => {
      focus("input")
    },
    clear: () => {
      setQuery("")
      focus("input")
    },
  }
}
