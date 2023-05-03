const COLORS = [
  "rgb(117,234,182)",
  "rgb(36,118,114)",
  "rgb(147,208,226)",
  "rgb(51,74,171)",
  "rgb(196,111,216)",
  "rgb(129,32,80)",
  "rgb(162,151,202)",
  "rgb(127,32,172)",
  "rgb(251,9,152)",
  "rgb(99,74,98)",
]

let nextIndex = 0
export function useRenderColor() {
  const color = COLORS[nextIndex]
  nextIndex++
  if (nextIndex > COLORS.length - 1) {
    nextIndex = 0
  }
  return color
}
