import { useState, useEffect, useMemo } from "react"

type SelectOptions<Datum> = {
  data?: Datum[]
  label: string
  onInputChange?: (value: string) => void
  getOptionId: (item: Datum) => string
  onSelect?: (item: Datum) => void
  minQueryLength?: number
}

export const useSelect = <Datum>({
  data,
  label,
  onInputChange,
  getOptionId,
  onSelect,
  minQueryLength = 1,
}: SelectOptions<Datum>) => {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [query, setQuery] = useState("")

  useEffect(
    function keepSelectionWithinResults() {
      setHighlightedIndex(-1)
    },
    [data?.length]
  )

  const activeDescendantId = useMemo(
    function updateActiveDescendant() {
      if (highlightedIndex === -1) return undefined
      if (!data) return undefined
      if (data.length < 1) return undefined
      return getOptionId(data[highlightedIndex])
    },
    [highlightedIndex, data, getOptionId]
  )

  const selectItem = (item: Datum) => {
    setHidden(true)
    onSelect?.(item)
    setQuery("")
  }

  const handleKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setHidden(true)
      return
    }

    if (!data || data.length < 1) return

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
      setHighlightedIndex(data.length - 1)
      event.preventDefault()
    } else if (event.key === "Enter") {
      event.preventDefault()
      selectItem(data[highlightedIndex])
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      if (highlightedIndex < 1) return
      setHighlightedIndex((index) => index - 1)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()

      if (isHidden) setHidden(false)

      if (highlightedIndex >= data.length - 1) return

      setHighlightedIndex((index) => {
        return index + 1
      })
    }
  }

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

  const handleOptionClick = (index: number, event: React.MouseEvent) => {
    event.preventDefault()

    console.log("clicked", index)
    if (!data) {
      throw new Error(
        `Clicked on Select item index ${index} but there are no items`
      )
    }
    const item = data[index]

    if (!item) {
      throw new Error(
        `Clicked on Select item index ${index} but there are only ${data.length} items`
      )
    }

    selectItem(item)
  }

  const isExpanded = (items: Datum[] | undefined): items is Datum[] => {
    return query.trim().length >= minQueryLength && Boolean(items) && !isHidden
  }

  return {
    query,
    isExpanded: isExpanded(data),
    highlightedIndex,
    getInputProps: () => ({
      "onChange": handleInputChange,
      "role": "combobox",
      "aria-expanded": isExpanded(data),
      "onFocus": () => setHidden(false),
      "onBlur": () => setHidden(true),
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
      "onMouseDown": handleOptionClick.bind(null, index),
      "onMouseOver": () => setHighlightedIndex(index),
      "aria-selected": highlightedIndex === index,
      "id": data ? getOptionId(data[index]) : undefined,
    }),
    clear: () => {
      setQuery("")
    },
  }
}
