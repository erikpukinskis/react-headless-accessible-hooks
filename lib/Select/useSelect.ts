import { useState, useEffect, useMemo, useRef } from "react"

type SelectOptions<Datum> = {
  data?: Datum[]
  label: string
  onInputChange?: (value: string) => void
  getOptionValue: (item: Datum) => string
  onSelect?: (item: Datum) => void
  minQueryLength?: number
  closeOnBlur?: boolean
}

export const useSelect = <Datum>({
  data,
  label,
  getOptionValue,
  onSelect,
  closeOnBlur = true,
}: SelectOptions<Datum>) => {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const inputIsFocusedRef = useRef(false)

  useEffect(() => {
    setHighlightedIndex(0)

    if (inputIsFocusedRef.current) {
      setHidden(false)
    }
  }, [data])

  const activeDescendantId = useMemo(
    function updateActiveDescendant() {
      if (highlightedIndex === -1) return undefined
      if (!data) return undefined
      if (data.length < 1) return undefined
      const item = data[highlightedIndex]
      if (!item) return undefined
      return getOptionValue(item)
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

  const handleOptionClick = (item: Datum, event: React.MouseEvent) => {
    // We prevent default because we don't want clicking on an option to steal
    // the focus. If it did, you would end up in a situation where the search
    // input loses focus which closes the menu, and the option is gone before
    // the click on it can even register.
    event.preventDefault()

    selectItem(item)
  }

  const isExpanded = (items: Datum[] | undefined): items is Datum[] => {
    return Boolean(items) && !isHidden
  }

  const isHighlighted = (item: Datum) => {
    return item === data?.[highlightedIndex]
  }

  return {
    isExpanded: isExpanded(data),
    isHighlighted,
    getInputProps: () => ({
      "role": "combobox",
      "aria-expanded": isExpanded(data),
      "onFocus": () => {
        inputIsFocusedRef.current = true
        setHidden(false)
      },
      "onBlur": () => {
        inputIsFocusedRef.current = false
        if (!closeOnBlur) return
        setHidden(true)
      },
      "aria-activedescendant": activeDescendantId,
      "onKeyDownCapture": handleKeys,
    }),
    getListboxProps: () => ({
      "role": "listbox",
      "aria-label": label,
    }),
    getOptionProps: (item: Datum) => ({
      "role": "option",
      "onMouseDown": handleOptionClick.bind(null, item),
      "onMouseOver": () => {
        if (!data) {
          throw new Error("Moused over an option but there was no select data")
        }
        setHighlightedIndex(data.indexOf(item))
      },
      "aria-selected": isHighlighted(item),
      "id": data ? getOptionValue(item) : undefined,
    }),
  }
}
