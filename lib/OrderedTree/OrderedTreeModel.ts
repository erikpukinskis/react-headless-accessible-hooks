import { get, isEqual, noop } from "lodash"
import type {
  DatumFunctions,
  OrderedTreeBuild,
  OrderedTreeNode,
} from "./buildTree"
import { placeWithinSiblings } from "./buildTree"
import { getDrag } from "./drag"
import type { DebugDataDumper } from "~/Debug"
import { assert } from "~/helpers"

type OrderedTreeModelArgs<Datum> = {
  tree: OrderedTreeBuild<Datum>

  // Datum functions
  getParentId: DatumFunctions<Datum>["getParentId"]
  getOrder: DatumFunctions<Datum>["getOrder"]
  getId: DatumFunctions<Datum>["getId"]

  // Other
  dump?: DebugDataDumper
  moveNode: (
    nodeId: string,
    newOrder: number,
    newParentId: string | null
  ) => void
  collapseNode(nodeId: string): void
  expandNode(nodeId: string): void
}

export class OrderedTreeModel<Datum> {
  clientX = NaN
  clientY = NaN
  dragStart?: DragStart<Datum>
  dragEnd?: DragEnd
  getParentId: DatumFunctions<Datum>["getParentId"]
  getDatumOrder: DatumFunctions<Datum>["getOrder"]
  getId: DatumFunctions<Datum>["getId"]
  tree: OrderedTreeBuild<Datum>
  treeBox?: TreeBox
  dump: DebugDataDumper
  dragChildListenersById: Partial<
    Record<string | typeof NoParent, PlaceholderListener>
  > = {}
  moveNode: MoveNodeHandler

  constructor({
    tree,
    getParentId,
    getOrder,
    getId,
    dump,
    moveNode,
  }: OrderedTreeModelArgs<Datum>) {
    this.tree = tree
    this.getParentId = getParentId
    this.getDatumOrder = getOrder
    this.getId = getId
    this.dump = dump ?? noop
    this.moveNode = moveNode
  }

  cleanup() {
    const { dragStart } = this

    if (!dragStart) return

    window.removeEventListener("mousemove", dragStart.mouseMoveHandler)
    window.removeEventListener("mouseup", dragStart.mouseUpHandler)
  }

  setMoveNode(callback: MoveNodeHandler) {
    this.moveNode = callback
  }

  setTree(tree: OrderedTreeBuild<Datum>) {
    this.tree = tree
  }

  setTreeBox(box: TreeBox | undefined) {
    this.treeBox = box
  }

  getNode(datum: Datum) {
    return this.tree.nodesById[this.getId(datum)]
  }

  getOrder(datum: Datum) {
    return (
      this.getDatumOrder(datum) ??
      this.tree.missingOrdersById[this.getId(datum)]
    )
  }

  getNewOrder() {
    return this.dragEnd?.order
  }

  getPlaceholderDepth() {
    if (!this.dragEnd) {
      throw new Error(
        "Can't get placeholder depth because we are not dragging anything"
      )
    }

    return this.dragEnd.newDepth
  }

  getPlaceholderData(): Datum {
    if (!this.dragStart) {
      throw new Error("Can not get placeholder data when not dragging")
    }

    return this.dragStart.placeholderDatum
  }

  getPlaceholderOrder(): number {
    if (!this.dragEnd) {
      throw new Error("Can not get placeholder order when not dragging")
    }

    return this.dragEnd.order
  }

  getKey(datum: Datum) {
    const id = this.getId(datum)

    if (datum === this.dragStart?.placeholderDatum) {
      return `placeholder-node-${id}`
    } else {
      return `ordered-node-${id}`
    }
  }

  isExpanded(id: string): boolean {
    const node = this.tree.nodesById[id]
    return node.children.length > 0
  }

  isCollapsed(id: string): boolean {
    const node = this.tree.nodesById[id]
    return node.isCollapsed
  }

  isPlaceholder(datum: Datum): boolean {
    return datum === this.dragStart?.placeholderDatum
  }

  isBeingDragged(id: string) {
    if (!this.dragStart) return false
    return this.dragStart.node.id === id
  }

  childIsBeingDragged(parentId: string) {
    if (!this.dragStart) return false

    const dragNodeParentId = this.getParentId(this.dragStart.node.data)

    return parentId === dragNodeParentId
  }

  /**
   * Updates CSS positioning styles on the element being dragged
   */
  updateDragElementPosition() {
    if (!this.dragStart) return undefined

    const dx = this.clientX - this.dragStart.clientX
    const dy = this.clientY - this.dragStart.clientY
    const rowHeight = this.dragStart.treeBox.height / this.tree.treeSize
    const rowTop =
      this.dragStart.treeBox.offsetTop + this.dragStart.node.index * rowHeight

    const left = `${(this.dragStart.treeBox.offsetLeft + dx).toFixed(1)}px`
    const top = `${(rowTop + dy).toFixed(1)}px`

    const { element } = this.dragStart

    element.style.left = left
    element.style.top = top

    this.dump("drag position", `${left},${top}`)
  }

  /**
   * In order to reduce the amount of re-rendering we do in the tree, when the
   * drag changes from one row to another we only update the row that we just
   * left and the new row we're dragging into.
   *
   * To facilitate this, each time `useOrderedTreeChildNodes` is mounted it registers
   * a listener for that node. As the mouse moves, if we determine that node's
   * children change we call the listener and that triggers a re-render.
   */
  addPlaceholderListener(nodeId: string | null, listener: PlaceholderListener) {
    this.dragChildListenersById[nodeId ?? NoParent] = listener
  }

  /**
   * Notify a node that the drag child either just left their children, or is
   * just arriving into their children.
   */
  notifyNodeOfPlaceholderChange(
    nodeId: string | null,
    draggedIntoChildren: boolean,
    order: number | undefined
  ) {
    this.dragChildListenersById[nodeId ?? NoParent]?.(
      draggedIntoChildren,
      order
    )
  }

  /**
   * On unmount, `useOrderedTreeChildNodes` removes its listener.
   */
  removePlaceholderListener(
    nodeId: string | null,
    listener: PlaceholderListener
  ) {
    if (this.dragChildListenersById[nodeId ?? NoParent] !== listener) {
      return
    }
    delete this.dragChildListenersById[nodeId ?? NoParent]
  }

  /**
   * This is a big function that runs every time the mouse moves during a drag.
   * It's got a lot to do, but it needs to be fast and have minimal side
   * effects.
   *
   * It...
   *  - Calculates what the new drag state is using `getDrag`
   *  - Collapses the drag node if it has expanded children
   *  - Figures out what the new parent id and order is for the drag node
   *  - Notifies any parent nodes if they need to re-render their children
   */
  handleMouseMove(event: MouseEvent) {
    this.clientX = event.clientX
    this.clientY = event.clientY

    this.dump("clientX", this.clientX)
    this.dump("clientY", this.clientY)

    // if (isDropping) {
    //   return
    // }

    if (!this.dragStart) return

    this.updateDragElementPosition()

    const rowHeight = this.dragStart.treeBox.height / this.tree.treeSize
    const treeY = this.clientY - this.dragStart.treeBox.top
    this.dump("treeY", treeY)
    const hoverIndex = Math.floor(treeY / rowHeight)
    const dx = this.clientX - this.dragStart.clientX
    const dy = this.clientY - this.dragStart.clientY

    const dragData = getDrag(
      this.tree.nodesByIndex,
      this.dragStart.node.index,
      hoverIndex,
      dx,
      dy
    )

    const { relativeTo } = dragData

    this.dump(
      "move",
      dragData.move,
      relativeTo ? (get(relativeTo, "data.name") as string) : undefined
    )

    this.dump("target depth", dragData.roundedTargetDepth)

    // if (need.subneeds.length > 0) {
    //   setNeedIdToExpand(need.id)
    //   updateNeed(need, { collapse: true })
    // }

    let newOrder: number
    let newParentId: string | null
    let newDepth: number

    if (dragData.move === "nowhere") {
      newOrder = assert(this.dragStart.originalOrder, "No original order")
      newParentId = this.getParentId(this.dragStart.node.data)
      newDepth = this.dragStart.node.parents.length
    } else if (dragData.relativeTo === undefined) {
      throw new Error(
        "Why is relativeTo undefined if we're dragging somewhere?"
      )
    } else if (dragData.move === "first-child") {
      newOrder = 0.5
      newParentId = dragData.relativeTo.id
      newDepth = dragData.relativeTo.parents.length + 1
    } else {
      const newParent = dragData.relativeTo.parents[0]
      const siblings = newParent ? newParent.children : this.tree.roots

      newOrder = placeWithinSiblings({
        direction: dragData.move,
        relativeToId: dragData.relativeTo.id,
        siblings,
        missingOrdersById: this.tree.missingOrdersById,
        getOrder: this.getOrder.bind(this),
        getId: this.getId,
      })

      newParentId = newParent?.id ?? null

      newDepth = dragData.relativeTo.parents.length
    }

    const newDrag = {
      order: newOrder,
      parentId: newParentId,
      newDepth,
    }

    if (isEqual(this.dragEnd, newDrag)) return

    this.dump("new order", newOrder.toFixed(20))
    this.dump(
      "new parent",
      newParentId === null
        ? "top level"
        : newParentId === undefined
        ? "original parent"
        : newParentId
    )

    const oldParentId = this.dragEnd?.parentId
    const oldOrder = this.dragEnd?.order

    this.dragEnd = newDrag
    console.log("new dragEnd", newDrag)

    // If there was already a dragEnd previously, there will be an oldParentId
    // here, which means the placeholder has already been placed amidst some
    // siblings, and we might need to remove it. We only do that if the
    // newParentId is different. In that case the order (within that old parent)
    // can be undefined.
    if (oldParentId !== undefined && oldParentId !== newParentId) {
      this.notifyNodeOfPlaceholderChange(oldParentId, false, undefined)
    }

    // If there is a new parent, we need to tell that parent they have the
    // placeholder now. We also inform them if the order of the placeholder
    // changed within that same parent.
    if (
      newParentId !== undefined &&
      (newParentId !== oldParentId || newOrder !== oldOrder)
    ) {
      this.notifyNodeOfPlaceholderChange(newParentId, true, newOrder)
    }
  }

  handleMouseDown(datum: Datum, event: React.MouseEvent) {
    if (!this.treeBox) return

    const mouseMoveHandler = this.handleMouseMove.bind(this)
    const mouseUpHandler = this.handleMouseUp.bind(this)

    this.clientX = event.clientX
    this.clientY = event.clientY

    const element = event.currentTarget

    if (!(element instanceof HTMLElement)) {
      throw new Error(
        "useOrderedTree doesn't support SvgElement or other non-HTML Element types"
      )
    }

    const rect = element.getBoundingClientRect()

    element.style.width = `${rect.width}px`
    element.style.height = `${rect.height}px`
    element.style.boxSizing = "border-box"

    const node = this.tree.nodesById[this.getId(datum)]

    this.dragStart = {
      node,
      placeholderDatum: { ...datum, __isRhahPlaceholder: true },
      element,
      clientX: this.clientX,
      clientY: this.clientY,
      treeBox: this.treeBox,
      originalOrder: node.order,
      mouseMoveHandler,
      mouseUpHandler,
    }

    window.addEventListener("mousemove", mouseMoveHandler)
    window.addEventListener("mouseup", mouseUpHandler)
  }

  handleMouseUp() {
    const { dragStart, dragEnd } = this

    this.dragStart = undefined
    this.dragEnd = undefined

    if (!dragStart) {
      throw new Error("Got a mouseup event but drag never started")
    }

    if (!dragEnd) {
      // The mouse never moved
      return
    }

    if (dragEnd.parentId !== undefined) {
      this.notifyNodeOfPlaceholderChange(dragEnd.parentId, false, undefined)
      this.moveNode(dragStart.node.id, dragEnd.order, dragEnd.parentId)
    }

    window.removeEventListener("mouseup", dragStart.mouseUpHandler)

    if (isLackingPrecision(dragEnd.order)) {
      throw new Error(
        `Hit the minimum precision on a tree node order (on id ${this.getId(
          dragStart.node.data
        )}). We should defragment here, but RHAH doesn't support that yet`
      )
    }
  }
}

type DragStart<Datum> = {
  node: OrderedTreeNode<Datum>
  placeholderDatum: Datum
  element: HTMLElement
  clientX: number
  clientY: number
  treeBox: TreeBox
  originalOrder: number
  mouseMoveHandler(this: void, event: MouseEvent): void
  mouseUpHandler(this: void): void
}

type TreeBox = {
  top: number
  height: number
  offsetLeft: number
  offsetTop: number
}

export type DragEnd = {
  /**
   * Number between 0 and 1 representing the node's position within its siblings
   */
  order: number
  /**
   * The new parentId that should be set for the drag child. Will be `string` or
   * `null` if we're dragging into a new position within some nodes. Will be
   * `undefined` when we haven't dragged anywhere, or if we dragged off of the
   * tree. In these cases, we just leave the dragged row in the tree as if
   * nothing happened.
   */
  parentId: string | null | undefined
  /**
   * The new depth of the node if we dropped it here
   */
  newDepth: number
}

export type PlaceholderListener = (
  placeholderIsIncluded: boolean,
  order: number | undefined
) => void

const NoParent = Symbol("NoParent")

type MoveNodeHandler = (
  id: string,
  newOrder: number,
  newParentId: string | null
) => void

/**
 * This function returns `true` if an `order` is dangerously close to `0` or `1`
 * requiring defragmentation of sibling order.
 *
 * When you drag a node to the beginning of a list, we keep setting the `order`
 * smaller and smaller. So if the `order` of the first item in the list is `0.1`
 * and we drag another item before that, it gets an `order` of `0.05`. If we
 * drag an item before _that_, it gets an order of `0.025`. Then `0.0125` then
 * `0.00625`, `0.003125`, `0.0015625`, etc.
 *
 * Eventually, by dragging elements to the beginning of a list too many times,
 * the `order` will get very small: too small for JavaScript to represent or
 * Firebase to store. The `order` effectively becomes `0`. Dragging more items
 * before that item will also give those items an `order` of `0`. Those items
 * will then appear at the beginning of the list, but in a random order.
 *
 * The same can happen at the end of the list with the `order` becoming `1`.
 *
 * `Number.MIN_VALUE` is the smallest number JavaScript can represent.
 * `Number.EPSILON` is difference between `1` and the smallest number JavaScript
 * can represent greater than `1`. So we use `MIN_VALUE` as a lower bound on
 * `order` and `1 - Number.EPSILON` as an upper bound.
 *
 * Firebase and JavaScript both seem to support a similar minimum value, 5e-324.
 * Since the `order` gets halved each time you drag an item to the top of the
 * list, you could drag approximatly 648 items to the top of the list before
 * defragmentation is required. For numbers close to `1`, the precision appears
 * to be less ~2e-16, so defragmentation could be required after dragging only
 * 32 items to the bottom of the list.
 *
 * Defragmentation means on a list of ~100 items, the `order`s would become
 * `0.01`, `0.02`, etc up to `0.99`. You could then drag items to the top of
 * that list another ~648 items before requiring defragmentation again.
 */
function isLackingPrecision(order: number) {
  if (order <= Number.MIN_VALUE) return true

  if (1 - order <= Number.EPSILON) return true

  return false
}
