import { useState, useEffect, useMemo, useRef } from "react"

type SelectOptions<Datum> = {
  data?: Datum[]
  label: string
  onInputChange?: (value: string) => void
  getOptionValue: (item: Datum) => string
  onSelect?: (
    item: Datum
  ) => boolean | void | undefined | Promise<boolean | void | undefined>
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
  const didMouseDownOnOptionRef = useRef(false)
  const [focusedElementCount, setFocusedElementCount] = useState(0)
  const focusedElementCountRef = useRef<number | undefined>()

  const focus = (addingFocus: boolean) => {
    const oldCount = focusedElementCountRef.current ?? 0
    const newCount = addingFocus ? oldCount + 1 : oldCount - 1

    focusedElementCountRef.current = newCount

    setFocusedElementCount(newCount)
  }

  useEffect(() => {
    if (focusedElementCountRef.current === undefined) return

    setTimeout(() => {
      if (focusedElementCountRef.current === 0) {
        setHidden(true)
      }
    })
  }, [focusedElementCount])

  const valuesHash = useMemo(() => {
    return data?.map(getOptionValue).join("-----")
  }, [data, getOptionValue])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [valuesHash])

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

  const selectItem = async (item: Datum) => {
    const hide = await onSelect?.(item)
    if (hide === false) return
    setHidden(true)
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
      void selectItem(data[highlightedIndex])
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      if (highlightedIndex === 0) return
      else if (isHidden) setHighlightedIndex(data.length - 1)
      else setHighlightedIndex((index) => index - 1)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      if (highlightedIndex >= data.length - 1) return
      else if (isHidden) setHighlightedIndex(0)
      else setHighlightedIndex((index) => index + 1)
    }

    setHidden(false)
  }

  const handleOptionClick = (item: Datum) => {
    didMouseDownOnOptionRef.current = false
    void selectItem(item)
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
        focus(true)
        setHidden(false)
      },
      "onBlur": () => {
        focus(false)
      },
      "aria-activedescendant": activeDescendantId,
      "onKeyDownCapture": handleKeys,
    }),
    getListboxProps: () => ({
      "role": "listbox",
      "aria-label": label,
      onFocus: () => {
        focus(true)
      },
      onBlur: () => {
        focus(false)
      },
    }),
    getOptionProps: (item: Datum) => ({
      "role": "option",
      "onClick": handleOptionClick.bind(null, item),
      "onMouseDown": () => {
        didMouseDownOnOptionRef.current = true
      },
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
