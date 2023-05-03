import { Temporal } from "@js-temporal/polyfill"

export function now() {
  return Temporal.Now.instant()
}

export function toUnix(instant: string | Temporal.Instant) {
  if (typeof instant === "string") {
    instant = Temporal.Instant.from(instant)
  }
  return instant.epochSeconds
}
