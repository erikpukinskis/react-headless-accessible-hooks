import { useState, useEffect, useMemo, useRef } from "react"

type SelectOptions<Datum> = {
  data?: Datum[]
  label: string
  onInputChange?: (value: string) => void
  getOptionValue: (item: Datum) => string
  onSelect?: (
    item: Datum
  ) => boolean | void | undefined | Promise<boolean | void | undefined>
  onBlur?(): void
  minQueryLength?: number
}

export type SelectInputProps = {
  role: string
  "aria-expanded": boolean
  onFocus: () => void
  onBlur: () => void
  onKeyDownCapture: (event: {
    key: string
    metaKey: boolean
    preventDefault(): void
    stopPropagation(): void
  }) => void
  onMouseDown: () => void
}

export const useSelect = <Datum>({
  data,
  label,
  getOptionValue,
  onSelect,
  onBlur,
}: SelectOptions<Datum>) => {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const didMouseDownOnOptionRef = useRef(false)
  const [focusedElementCount, setFocusedElementCount] = useState(0)
  const focusedElementCountRef = useRef<number | undefined>()
  const mouseDownItemRef = useRef<Datum | undefined>()

  const updateFocusedElementCount = (increment: 1 | -1) => {
    const oldCount = focusedElementCountRef.current ?? 0
    const newCount = oldCount + increment

    focusedElementCountRef.current = newCount

    setFocusedElementCount(newCount)
  }

  useEffect(() => {
    if (focusedElementCountRef.current === undefined) return

    setTimeout(() => {
      if (focusedElementCountRef.current) return
      if (didMouseDownOnOptionRef.current) return
      setHidden(true)
      onBlur?.()
    })
  }, [focusedElementCount, onBlur])

  const valuesHash = useMemo(() => {
    return data?.map(getOptionValue).join("-----")
  }, [data, getOptionValue])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [valuesHash])

  // const activeDescendantId = useMemo(
  //   function updateActiveDescendant() {
  //     if (highlightedIndex === -1) return undefined
  //     if (!data) return undefined
  //     if (data.length < 1) return undefined
  //     const item = data[highlightedIndex]
  //     if (!item) return undefined
  //     return getOptionValue(item)
  //   },
  //   [highlightedIndex, data, getOptionValue]
  // )

  const selectItem = async (item: Datum) => {
    const hide = (await onSelect?.(item)) ?? true
    if (hide) setHidden(true)
  }

  const handleKeys: SelectInputProps["onKeyDownCapture"] = (event) => {
    if (event.key === "Escape") {
      setHidden(true)
      onBlur?.()
      return
    }

    if (!data || data.length < 1) return

    if (
      event.key === "PageUp" ||
      (event.key === "ArrowLeft" && event.metaKey)
    ) {
      event.preventDefault()
      event.stopPropagation()
      setHighlightedIndex(0)
    } else if (
      event.key === "PageDown" ||
      (event.key === "ArrowRight" && event.metaKey)
    ) {
      event.preventDefault()
      event.stopPropagation()
      setHighlightedIndex(data.length - 1)
    } else if (event.key === "Enter") {
      event.preventDefault()
      event.stopPropagation()
      void selectItem(data[highlightedIndex])
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      event.stopPropagation()
      if (highlightedIndex === 0) return
      else if (isHidden) setHighlightedIndex(data.length - 1)
      else setHighlightedIndex((index) => index - 1)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      event.stopPropagation()
      if (highlightedIndex >= data.length - 1) return
      else if (isHidden) setHighlightedIndex(0)
      else setHighlightedIndex((index) => index + 1)
    }

    setHidden(false)
  }

  const handleOptionClick = (event: React.MouseEvent, item: Datum) => {
    event.preventDefault()
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
    getInputProps: (): SelectInputProps => ({
      "role": "combobox",
      "aria-expanded": isExpanded(data),
      "onMouseDown": () => {
        if (isHidden) {
          setHidden(false)
        }
      },
      "onFocus": () => {
        updateFocusedElementCount(1)
        setHidden(false)
      },
      "onBlur": () => {
        updateFocusedElementCount(-1)
      },
      // This is making focus get stuck on the input on load sometimes (with an Evergreen TagInput anyway)
      // "aria-activedescendant": activeDescendantId,
      "onKeyDownCapture": handleKeys,
    }),
    getListboxProps: () => ({
      "role": "listbox",
      "aria-label": label,
      onFocus: () => {
        updateFocusedElementCount(1)
      },
      onBlur: () => {
        updateFocusedElementCount(-1)
      },
    }),
    getOptionProps: (item: Datum) => ({
      "role": "option",
      "onClick": (event: React.MouseEvent) => handleOptionClick(event, item),
      "onMouseDown": (event: React.MouseEvent) => {
        event.preventDefault()
        mouseDownItemRef.current = item
        didMouseDownOnOptionRef.current = true
      },
      "onMouseUp": () => {
        setTimeout(() => {
          didMouseDownOnOptionRef.current = false
        })
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
