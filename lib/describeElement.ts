export function describeElement(element: Element) {
  const tag = element.tagName.toLowerCase()

  let html = `<${tag}`

  for (let i = 0; i < element.attributes.length; i++) {
    const { name, value } = element.attributes[i]
    html += ` ${name}="${value}"`
  }

  return `${html} />`
}
