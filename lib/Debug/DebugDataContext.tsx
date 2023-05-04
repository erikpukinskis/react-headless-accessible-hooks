import React, { createContext, useContext, useEffect, useState } from "react"
import { DebugDataService, type Dumpable } from "./DebugDataService"
import { makeUninitializedContext } from "~/helpers"

const DebugDataContext = createContext(
  makeUninitializedContext<DebugDataService>(
    "Cannot use DebugDataContext outside of a DebugDataProvider"
  )
)

type DebugDataProviderProps = {
  children: React.ReactNode
}

export function DebugDataProvider({ children }: DebugDataProviderProps) {
  const [service] = useState(() => new DebugDataService())

  useEffect(() => {
    return () => service.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DebugDataContext.Provider value={service}>
      {children}
    </DebugDataContext.Provider>
  )
}

export function useDebugData() {
  const [values, setValues] = useState<Record<string, string>>({})
  const service = useContext(DebugDataContext)

  useEffect(() => {
    service.addChangeListener(setValues)

    return () => service.removeChangeListener(setValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return values
}

export function useDumpDebugData() {
  const service = useContext(DebugDataContext)

  return function dumpDebugData(
    key: string,
    ...values: (Dumpable | null | undefined)[]
  ) {
    service.dump(key, values)
  }
}
