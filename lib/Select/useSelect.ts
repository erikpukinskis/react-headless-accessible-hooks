import { useState, useEffect, useMemo } from "react"

type SelectOptions<Datum> = {
  data?: Datum[]
  label: string
  onInputChange?: (value: string) => void
  getOptionValue: (item: Datum) => string
  onSelect?: (item: Datum) => void
  minQueryLength?: number
}

export const useSelect = <Datum>({
  data,
  label,
  getOptionValue,
  onSelect,
}: SelectOptions<Datum>) => {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  useEffect(() => {
    setHighlightedIndex(0)
  }, [data])

  const activeDescendantId = useMemo(
    function updateActiveDescendant() {
      if (highlightedIndex === -1) return undefined
      if (!data) return undefined
      if (data.length < 1) return undefined
      return getOptionValue(data[highlightedIndex])
    },
    [highlightedIndex, data, getOptionValue]
  )

  const selectItem = (item: Datum) => {
    setHidden(true)
    onSelect?.(item)
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
    return Boolean(items) && !isHidden
  }

  return {
    isExpanded: isExpanded(data),
    highlightedIndex,
    getInputProps: () => ({
      "role": "combobox",
      "aria-expanded": isExpanded(data),
      "onFocus": () => setHidden(false),
      "onBlur": () => setHidden(true),
      "aria-activedescendant": activeDescendantId,
      "aria-label": label,
      "onKeyDownCapture": handleKeys,
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
      "id": data ? getOptionValue(data[index]) : undefined,
    }),
  }
}
