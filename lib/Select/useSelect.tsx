import { useState, useEffect, useMemo, useRef } from "react"

type SelectOptions<DataType> = {
  data?: DataType[]
  label: string
  onInputChange?: (value: string) => void
  getOptionValue: (item: DataType) => string
  onSelect?: (
    item: DataType,
    options: {
      close: () => void
    }
  ) => void
  onBlur?(): void
  minQueryLength?: number
}

export type SelectInputProps<
  InputElementType extends HTMLElement = HTMLInputElement
> = {
  role: string
  "aria-expanded": boolean
  onKeyDownCapture: (event: {
    key: string
    metaKey: boolean
    preventDefault(): void
    stopPropagation(): void
  }) => void
  ref: React.RefObject<InputElementType>
  onMouseDown: () => void
}

export type SelectListboxProps<
  ListboxElementType extends HTMLElement = HTMLDivElement
> = {
  role: string
  "aria-label": string
  ref: React.RefObject<ListboxElementType>
}

export function useSelect<
  DataType,
  InputElementType extends HTMLElement = HTMLInputElement,
  ListboxElementType extends HTMLElement = HTMLDivElement
>({ data, label, getOptionValue, onSelect, onBlur }: SelectOptions<DataType>) {
  const [isHidden, setHidden] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const inputRef = useRef<InputElementType>(null)
  const listboxRef = useRef<ListboxElementType>(null)

  const valuesHash = useMemo(() => {
    return data?.map(getOptionValue).join("-----")
  }, [data, getOptionValue])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [valuesHash])

  useEffect(() => {
    if (isHidden) return

    const handleBackdropClick = (event: MouseEvent) => {
      const isDescendant = elementIsDescendantOf(
        event.target,
        inputRef.current,
        listboxRef.current
      )

      if (isDescendant) return

      setHidden(true)
    }

    document.addEventListener("click", handleBackdropClick)

    return () => {
      document.removeEventListener("click", handleBackdropClick)
    }
  }, [isHidden])

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

  const selectItem = (item: DataType) => {
    onSelect?.(item, { close: () => setHidden(true) })
  }

  const handleKeys: SelectInputProps<InputElementType>["onKeyDownCapture"] = (
    event
  ) => {
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

  const handleOptionClick = (event: React.MouseEvent, item: DataType) => {
    event.preventDefault() // why do we need this?
    void selectItem(item)
  }

  const isExpanded = (items: DataType[] | undefined): items is DataType[] => {
    return Boolean(items) && !isHidden
  }

  const isHighlighted = (item: DataType) => {
    return item === data?.[highlightedIndex]
  }

  return {
    isExpanded: isExpanded(data),
    isHighlighted,
    getInputProps: (): SelectInputProps<InputElementType> => ({
      "role": "combobox",
      "aria-expanded": isExpanded(data),
      "onMouseDown": () => {
        if (isHidden) {
          setHidden(false)
        }
      },
      // This is making focus get stuck on the input on load sometimes (with an Evergreen TagInput anyway)
      // "aria-activedescendant": activeDescendantId,
      "onKeyDownCapture": handleKeys,
      ref: inputRef,
    }),
    getListboxProps: (): SelectListboxProps<ListboxElementType> => ({
      "role": "listbox",
      "aria-label": label,
      ref: listboxRef,
    }),
    getOptionProps: (item: DataType) => ({
      "role": "option",
      "onClick": (event: React.MouseEvent) => {
        // If you're clicking something inside the option that does stuff, don't fire an option click event:
        if (isInteractive(event.target)) return

        handleOptionClick(event, item)
      },
      "onMouseDown": (event: React.MouseEvent) => {
        // If we're just clicking an option, we don't want to lose focus, so we want to interfere with the click
        if ((event.target as HTMLElement).tabIndex === -1) {
          event.preventDefault()
        }
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

function elementIsDescendantOf(
  target: EventTarget | null,
  ...elements: (HTMLElement | null)[]
) {
  for (const possibleParent of elements) {
    if (!possibleParent) continue
    if (possibleParent.contains(target as HTMLElement)) return true
  }

  return false
}

function isInteractive(target: EventTarget | null) {
  if (!target) return false

  let parent: HTMLElement | null = target as HTMLElement

  let depth = 0
  do {
    depth++
    if (parent.tabIndex >= 0) return true
    parent = parent.parentElement
    if (parent?.role === "listbox") return false
  } while (parent && depth < 20)

  if (depth >= 20) {
    throw new Error(
      "Searched 20 parents of an option without finding the listbox. That likely means an option was rendered outside of the listbox provided by useSelect which is not allowed."
    )
  }
}
