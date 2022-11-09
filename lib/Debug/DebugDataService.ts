import { Temporal } from "@js-temporal/polyfill"
import { throttle, without } from "lodash"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { makeUninitializedContext, now, toUnix } from "~/helpers"

type DebugDataChangeHandler = (values: Record<string, string>) => void

export type DebugDataDumper = (
  key: string,
  ...values: (Dumpable | null | undefined)[]
) => void

export type Dumpable = string | boolean | number

export class DebugDataService {
  values: Record<string, string> = {}
  keysUpdatedAt: Record<string, Temporal.Instant> = {}
  timer: NodeJS.Timer
  changeHandlers: DebugDataChangeHandler[] = []
  triggerChange: () => void

  constructor() {
    this.timer = setInterval(this.clearOldData.bind(this), 3000)
    this.triggerChange = throttle(() => {
      for (const handleChange of this.changeHandlers) {
        handleChange({ ...this.values })
      }
    }, 100)
  }

  addChangeListener(listener: DebugDataChangeHandler) {
    this.changeHandlers.push(listener)
  }

  removeChangeListener(listener: DebugDataChangeHandler) {
    this.changeHandlers = without(this.changeHandlers, listener)
  }

  dump(key: string, values: (Dumpable | null | undefined)[]) {
    const valueString = values.reduce((str: string, value) => {
      if (value === null) return str
      if (value === undefined) return str

      return `${str} ${String(value)}`
    }, "")

    if (this.values[key] === valueString) return

    this.values[key] = valueString
    this.keysUpdatedAt[key] = now()
    this.triggerChange()
  }

  clearOldData() {
    const rightNow = now()

    for (const [key, updatedAt] of Object.entries(this.keysUpdatedAt)) {
      if (updatedAt.until(rightNow).seconds > 2) {
        delete this.values[key]
        delete this.keysUpdatedAt[key]
        this.triggerChange()
      }
    }
  }

  destroy() {
    clearInterval(this.timer)
  }
}
