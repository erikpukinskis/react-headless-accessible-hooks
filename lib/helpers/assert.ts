export function assert<T>(maybe: T | undefined | null, message: string) {
  if (maybe == null) {
    throw new Error(
      message.replace("%s", maybe === null ? "null" : "undefined")
    )
  }

  return maybe
}

type HasElementTarget<T> = T & {
  target: HTMLElement
}

export function assertHTMLTarget<T>(
  event: T & {
    target: unknown
  }
): asserts event is HasElementTarget<T> {
  if (!(event.target instanceof HTMLElement)) {
    throw new Error(
      "What kind of MouseEvent doesn't have an HTMLElement for a target?"
    )
  }
}
