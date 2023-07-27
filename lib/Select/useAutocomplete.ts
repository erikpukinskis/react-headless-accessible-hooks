import { kebabCase } from "lodash"
import { useMemo, useState } from "react"

type AutocompleteArgs<Datum> = {
  data?: Datum[]
  getText(datum: Datum): string
  excludeIf?(datum: Datum): boolean
  addLabel?: string
}

export function useAutocomplete<Datum>(
  args: AutocompleteArgs<Datum> & { addLabel: undefined }
): UseAutocompleteReturnType<Datum>
export function useAutocomplete<Datum>(
  args: AutocompleteArgs<Datum> & { addLabel: string }
): UseAutocompleteReturnTypeWithAddOption<Datum>
export function useAutocomplete<Datum>({
  data,
  getText,
  excludeIf,
}: AutocompleteArgs<Datum>): UseAutocompleteReturnTypeWithAddOption<Datum> {
  const [query, setQuery] = useState("")

  const matches = useMemo(() => {
    if (!data) return []

    const trimmedQuery = query.trim()
    const kebabQuery = kebabCase(trimmedQuery)

    const options = data.filter((datum) => {
      if (excludeIf?.(datum)) return false
      return kebabCase(getText(datum)).includes(kebabQuery)
    })

    const exactMatch = options.find((datum) => {
      return kebabCase(getText(datum)) === kebabQuery
    })

    if (trimmedQuery && !exactMatch) {
      return [
        ...options,
        {
          __isAutocompleteAddOption: true as const,
          text: trimmedQuery,
        },
      ]
    } else {
      return options
    }
  }, [data, excludeIf, getText, query])

  return { query, setQuery, matches }
}

export type AddOption = {
  __isAutocompleteAddOption: true
  text: string
}

export function isAddOption(option: unknown | AddOption): option is AddOption {
  return Object.prototype.hasOwnProperty.call(
    option,
    "__isAutocompleteAddOption"
  )
}

type UseAutocompleteReturnType<Datum> = {
  query: string
  setQuery(newQuery: string): void
  matches: Datum[]
}

type UseAutocompleteReturnTypeWithAddOption<Datum> = {
  query: string
  setQuery(newQuery: string): void
  matches: (Datum | AddOption)[]
}
