export function describeElement(element: Element) {
  const tag = element.tagName

  if (element.id) {
    return `${tag}#${element.id}`
  } else if (element.classList.length > 0) {
    return `${tag}.${Array.from(element.classList).join(".")}`
  } else {
    return tag
  }
}
