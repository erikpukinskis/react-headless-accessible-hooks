export class OrderableListModel {
  rects: DOMRect[] = []
  maxElementIndex: number | undefined

  setRect(index: number, rect: DOMRect)
}
