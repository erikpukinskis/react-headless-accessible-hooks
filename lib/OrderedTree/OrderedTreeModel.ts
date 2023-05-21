import { get, isEqual, noop, union } from "lodash"
import type {
  DatumFunctions,
  OrderedTreeBuild,
  OrderedTreeNode,
} from "./buildTree"
import {
  buildTreeIndexesWithNodeCollapsed,
  placeWithinSiblings,
} from "./buildTree"
import { getDrag } from "./drag"
import type { DebugDataDumper } from "~/Debug"
import { assert } from "~/helpers"

type OrderedTreeModelArgs<Datum> = {
  tree: OrderedTreeBuild<Datum>
  functions: DatumFunctions<Datum>
  dump?: DebugDataDumper
  onNodeMove: (
    nodeId: string,
    newOrder: number,
    newParentId: string | null
  ) => void
  onClick?: (datum: Datum) => void
  onDroppingChange: (isDropping: boolean) => void
  collapseNode(nodeId: string): void
  expandNode(nodeId: string): void
}

export class OrderedTreeModel<Datum> {
  clientX = NaN
  clientY = NaN
  dragStart?: DragStart<Datum>
  dragEnd?: DragEnd
  isDropping = false
  functions: DatumFunctions<Datum>
  tree: OrderedTreeBuild<Datum>
  expansionOverrideMask: Record<string, "masked"> = {}
  treeBox?: TreeBox
  dump: DebugDataDumper
  nodeListenersById: Partial<Record<string | typeof NoParent, NodeListener>> =
    {}
  onNodeMove: MoveNodeHandler
  onClick?: (datum: Datum) => void
  onDroppingChange: (isDropping: boolean) => void

  constructor({
    tree,
    functions,
    dump,
    onNodeMove,
    onClick,
    onDroppingChange,
  }: OrderedTreeModelArgs<Datum>) {
    this.tree = tree
    this.functions = functions
    this.dump = dump ?? noop
    this.onNodeMove = onNodeMove
    this.onClick = onClick
    this.onDroppingChange = onDroppingChange
  }

  cleanup() {
    if (!this.dragStart) return

    window.removeEventListener("mousemove", this.dragStart.mouseMoveHandler)
    window.removeEventListener("mouseup", this.dragStart.mouseUpHandler)
  }

  setMoveHandler(callback: MoveNodeHandler) {
    this.onNodeMove = callback
  }

  setTree(tree: OrderedTreeBuild<Datum>) {
    const oldOverrides = this.tree.expansionOverrides
    this.tree = tree

    if (this.isDropping) {
      this.finishDrop()
    }

    const nodeIds = union(
      Object.keys(oldOverrides),
      Object.keys(tree.expansionOverrides)
    )

    for (const nodeId of nodeIds) {
      if (tree.expansionOverrides[nodeId] === oldOverrides[nodeId]) continue

      console.log("expansion override for", nodeId, "changed!")
      const node = tree.nodesById[nodeId]

      if (!node) continue // Node got filtered out

      this.notifyNodeOfChange(nodeId, {
        expansion: this.getExpansion(node.data),
      })
    }
  }

  setTreeBox(box: TreeBox | undefined) {
    this.treeBox = box
  }

  setFunctions(functions: DatumFunctions<Datum>) {
    this.functions = functions
  }

  setCollapsed(datum: Datum, isCollapsed: boolean) {
    isCollapsed // Don't need this yet, but we may in the future and this keeps Typescript happy

    const nodeId = this.functions.getId(datum)

    this.expansionOverrideMask[nodeId] = "masked"

    this.notifyNodeOfChange(nodeId, { expansion: this.getExpansion(datum) })
  }

  maskExpansionOverride(id: string) {
    this.expansionOverrideMask[id] = "masked"
  }

  getNode(datum: Datum) {
    return this.tree.nodesById[this.functions.getId(datum)]
  }

  getIndexes() {
    const didCollapseDragNode =
      this.dragStart && this.dragStart.node.children.length > 0

    if (!this.dragStart || !didCollapseDragNode) {
      const { nodesByIndex, indexesById } = this.tree

      return { nodesByIndex, indexesById }
    }

    // Return the indexes if we already calculated them
    if (this.dragStart.nodesByIndex && this.dragStart.indexesById) {
      const { nodesByIndex, indexesById } = this.dragStart

      return { nodesByIndex, indexesById }
    }

    const { nodesByIndex, indexesById } = buildTreeIndexesWithNodeCollapsed(
      this.tree,
      this.dragStart.node
    )

    this.dragStart.nodesByIndex = nodesByIndex
    this.dragStart.indexesById = indexesById

    return { nodesByIndex, indexesById }
  }

  getIndex(id: string) {
    const { indexesById } = this.getIndexes()

    const index = indexesById[id]

    if (index === undefined) {
      throw new Error(`No index for node ${id}`)
    }

    return index
  }

  // getOrder is slightly different than some of the other datum functions
  // because we infill missing orders during tree build. So this value could
  // come from the datum or it could come from tree.missingOrdersById.
  getOrder(datum: Datum) {
    return (
      this.functions.getOrder(datum) ??
      this.tree.missingOrdersById[this.functions.getId(datum)]
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

  getPlaceholderDatum(): Datum {
    if (!this.dragStart) {
      throw new Error("Can not get placeholder datum when not dragging")
    }

    return this.dragStart.placeholderDatum
  }

  getDroppedDatum(): Datum {
    if (!this.dragStart) {
      throw new Error("Can not get dropped datum when not dragging")
    }

    if (!this.isDropping) {
      throw new Error(
        "Cannot get dropped datum unless we are in the isDropping phase"
      )
    }

    return this.dragStart.node.data
  }

  /**
   * Returns true if there is no drag or drop in progress
   */
  isIdle() {
    return !this.dragStart
  }

  doesMatch(datum: Datum) {
    if (!this.functions.isFilteredOut) return false

    const isFilteredOut = this.functions.isFilteredOut(datum)

    if (isFilteredOut === undefined) return false

    return !isFilteredOut
  }

  isPlaceholderParent(id: string | null) {
    return this.dragEnd?.parentId === id
  }

  getPlaceholderOrder(): number {
    if (!this.dragEnd) {
      throw new Error("Can not get placeholder order when not dragging")
    }

    return this.dragEnd.order
  }

  getKey(datum: Datum) {
    if (datum === this.dragStart?.placeholderDatum) {
      const placeholderId = this.functions.getId(
        this.dragStart.placeholderDatum
      )
      const parentId = this.dragEnd?.parentId
      const parentDescription =
        parentId === null
          ? "root"
          : parentId === undefined
          ? "nothing"
          : parentId

      return `placeholder-node-${placeholderId}-under-${parentDescription}`
    } else {
      const id = this.functions.getId(datum)
      const parentId = this.functions.getParentId(datum) ?? "root"

      return `ordered-node-${id}-under-${parentId}`
    }
  }

  getExpansion(datum: Datum): "expanded" | "collapsed" | "no children" {
    const isPlaceholder = this.isPlaceholder(datum)
    const node = this.getNode(datum)
    const wasCollapsedByUser = this.functions.isCollapsed(datum)
    const hasChildren = node.children.length > 0 || node.hasCollapsedChildren
    const id = this.functions.getId(datum)
    const draggingIntoThisNode = id === this.dragEnd?.parentId
    const draggedOutTheOnlyChild =
      node.children.length === 1 &&
      node.children[0].id === this.dragStart?.node.id

    const override =
      this.expansionOverrideMask[id] === "masked"
        ? undefined
        : this.tree.expansionOverrides[id]

    if (wasCollapsedByUser && override !== "expanded") return "collapsed"

    if (isPlaceholder && hasChildren) return "collapsed"

    if (draggingIntoThisNode) return "expanded"

    if (draggedOutTheOnlyChild) return "no children"

    if (!hasChildren) return "no children"

    if (override === "collapsed") return "collapsed"

    return "expanded"
  }

  isLastChild(id: string): boolean {
    const node = this.tree.nodesById[id]

    const siblings =
      node.parents.length < 1 ? this.tree.roots : node.parents[0].children

    let lastChild = siblings[siblings.length - 1]
    const lastChildIsBeingDragged = lastChild.id === this.dragStart?.node.id

    if (lastChildIsBeingDragged) {
      lastChild = siblings[siblings.length - 2]
    }

    return id === lastChild.id
  }

  isPlaceholder(datum: Datum): boolean {
    return datum === this.dragStart?.placeholderDatum
  }

  isBeingDragged(datum: Datum) {
    if (!this.dragStart) return false
    else if (this.isDropping) return false
    else return this.dragStart.node.data === datum
  }

  childIsBeingDragged(parentId: string) {
    if (!this.dragStart) return false

    const dragNodeParentId = this.functions.getParentId(
      this.dragStart.node.data
    )

    return parentId === dragNodeParentId
  }

  hasChildren(parentId: string) {
    return this.tree.nodesById[parentId].children.length > 0
  }

  /**
   * Updates CSS positioning styles on the element being dragged
   */
  updateDragElementPosition() {
    if (!this.dragStart) return undefined

    const dx = this.clientX - this.dragStart.clientX
    const dy = this.clientY - this.dragStart.clientY
    const rowHeight = this.dragStart.treeBox.height / this.tree.treeSize
    const index = this.getIndex(this.dragStart.node.id)
    const rowTop = index * rowHeight

    const left = `${dx.toFixed(1)}px`
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
  addPlaceholderListener(nodeId: string | null, listener: NodeListener) {
    this.nodeListenersById[nodeId ?? NoParent] = listener
  }

  /**
   * There are a few different states of a node which change during the course
   * of a drag. In order to only re-render the smallest number of nodes
   * possible, each node in the tree sets up a listener (in the useParent hook).
   * This function is used to notify those listeners of a temporary change to
   * those pieces of state that can change during a drag:
   *
   *  - Whether the placeholder has been dragged into this node, and at what
   *    order
   *  - Whether a node has been dropped into this node, and at what order
   *  - Whether the node has been collapsed or expanded during the course of the
   *    drag
   */
  notifyNodeOfChange(nodeId: string | null, change: NodeChange) {
    this.nodeListenersById[nodeId ?? NoParent]?.(change)
  }

  /**
   * On unmount, `useOrderedTreeChildNodes` removes its listener.
   */
  removePlaceholderListener(nodeId: string | null, listener: NodeListener) {
    if (this.nodeListenersById[nodeId ?? NoParent] !== listener) {
      return
    }
    delete this.nodeListenersById[nodeId ?? NoParent]
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
    this.clientX = event.clientX + window.scrollX
    this.clientY = event.clientY + window.scrollY

    this.dump("clientX", this.clientX)
    this.dump("clientY", this.clientY)
    this.dump("scrollY", window.scrollY)

    if (!this.dragStart) {
      // throw new Error("No dragStart but we received a mouse move")
      return
    }

    this.updateDragElementPosition()

    const rowHeight = this.dragStart.treeBox.height / this.tree.treeSize
    const treeY = this.clientY - this.dragStart.treeBox.top
    this.dump("treeY", treeY)
    const hoverIndex = Math.floor(treeY / rowHeight)
    const dx = this.clientX - this.dragStart.clientX
    const dy = this.clientY - this.dragStart.clientY

    if (dy < 1 && dy > -1 && dx < 1 && dx > -1) return

    const { nodesByIndex } = this.getIndexes()

    const dragData = getDrag({
      nodesByIndex,
      downIndex: this.getIndex(this.dragStart.node.id),
      hoverIndex,
      dx,
      dy,
      isCollapsed: this.functions.isCollapsed,
      isLastChild: this.isLastChild.bind(this),
    })

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
      newParentId = this.functions.getParentId(this.dragStart.node.data)
      newDepth = this.dragStart.node.parents.length
    } else if (dragData.relativeTo === undefined) {
      throw new Error(
        "Why is relativeTo undefined if we're dragging somewhere?"
      )
    } else if (dragData.move === "first-child") {
      newOrder = placeWithinSiblings({
        direction: "first-child",
        relativeToId: dragData.relativeTo.id,
        siblings: dragData.relativeTo.children,
        missingOrdersById: this.tree.missingOrdersById,
        getOrder: this.getOrder.bind(this),
        getId: this.functions.getId,
      })

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
        getId: this.functions.getId,
      })

      newParentId = newParent?.id ?? null

      newDepth = dragData.relativeTo.parents.length
    }

    const newDragEnd = {
      order: newOrder,
      parentId: newParentId,
      newDepth,
    }

    if (isEqual(this.dragEnd, newDragEnd)) return

    const { dragEnd, dragStart } = this

    this.dragEnd = newDragEnd

    this.dump("new order", newOrder.toFixed(20))
    this.dump(
      "new parent",
      newParentId === null
        ? "top level"
        : newParentId === undefined
        ? "original parent"
        : newParentId
    )

    const oldParentId = dragEnd
      ? dragEnd.parentId
      : this.functions.getParentId(dragStart.node.data)

    const oldOrder = dragEnd?.order

    // Regardless of whether there is a DragEnd yet, there will be. So we need
    // to notify the old parent that its expansion has possibly changed. If
    // there is a DragEnd and the parent has changed then we can skip this.
    if (oldParentId !== undefined && newParentId !== oldParentId) {
      const expansion =
        oldParentId === null
          ? "expanded"
          : this.getExpansion(this.tree.nodesById[oldParentId].data)

      this.notifyNodeOfChange(oldParentId, {
        expansion,
      })
    }

    if (!dragEnd && dragStart.node.children.length > 0) {
      // We just started dragging a node with children, so tell it that it is
      // collapsed now so the children are hidden and the expansion state
      // changes
      this.notifyNodeOfChange(dragStart.node.id, {
        expansion: "collapsed",
      })
    }

    if (oldParentId !== undefined && oldParentId !== newParentId) {
      // If there was already a dragEnd previously, there will be an oldParentId
      // here, which means the placeholder has already been placed amidst some
      // siblings, and we might need to remove it. We only do that if the
      // newParentId is different. In that case the placeholder order (within that old parent)
      // will be null, which means the placeholder is no longer a child.
      this.notifyNodeOfChange(oldParentId, {
        placeholderOrder: null,
      })
    }

    if (
      newParentId !== undefined &&
      (newParentId !== oldParentId || newOrder !== oldOrder)
    ) {
      // If there is a new parent, we need to tell that parent they have the
      // placeholder now. We also inform them if the order of the placeholder
      // changed within that same parent.
      const expansion =
        newParentId === null
          ? "expanded"
          : this.getExpansion(this.tree.nodesById[newParentId].data)

      this.notifyNodeOfChange(newParentId, {
        placeholderOrder: newOrder,
        expansion,
      })
    }
  }

  handleMouseDown(datum: Datum, event: React.MouseEvent) {
    // If we've dropped something, we temporarily disable dragging until we get
    // a new tree via setTree
    if (this.isDropping) return

    if (!this.treeBox) return

    const mouseMoveHandler = this.handleMouseMove.bind(this)
    const mouseUpHandler = this.handleMouseUp.bind(this)

    this.clientX = event.clientX + window.scrollX
    this.clientY = event.clientY + window.scrollY

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

    const node = this.tree.nodesById[this.functions.getId(datum)]

    this.dragStart = {
      node,
      placeholderDatum: { ...datum, __isRhahPlaceholder: true },
      element,
      clientX: this.clientX,
      clientY: this.clientY,
      treeBox: this.treeBox,
      originalOrder: this.getOrder(node.data),
      mouseMoveHandler,
      mouseUpHandler,
    }

    window.addEventListener("mousemove", mouseMoveHandler)
    window.addEventListener("mouseup", mouseUpHandler)
  }

  handleMouseUp() {
    const { dragStart, dragEnd } = this

    if (!dragStart) {
      throw new Error("Got a mouseup event but drag never started")
    }

    if (!dragEnd) {
      // The mouse never moved

      const { dragStart } = this

      if (!dragStart) {
        throw new Error("Received a mouse up, but drag was never started?")
      }

      this.dragStart = undefined
      this.onClick?.(dragStart.node.data)

      window.removeEventListener("mouseup", dragStart.mouseUpHandler)
      window.removeEventListener("mousemove", dragStart.mouseMoveHandler)

      return
    }

    this.isDropping = true
    this.onDroppingChange(true)

    // Reset the drag node back like it was (expanded or collapsed or whatever)
    this.notifyNodeOfChange(dragStart.node.id, {
      expansion: this.getExpansion(dragStart.node.data),
    })

    if (dragEnd.parentId !== undefined) {
      const originalParentId = this.functions.getParentId(dragStart.node.data)

      this.notifyNodeOfChange(originalParentId, { isDropping: true })

      this.onNodeMove(dragStart.node.id, dragEnd.order, dragEnd.parentId)
    }

    window.removeEventListener("mouseup", dragStart.mouseUpHandler)
    window.removeEventListener("mousemove", dragStart.mouseMoveHandler)

    if (isLackingPrecision(dragEnd.order)) {
      throw new Error(
        `Hit the minimum precision on a tree node order (on id ${this.functions.getId(
          dragStart.node.data
        )}). We should defragment here, but RHAH doesn't support that yet`
      )
    }
  }

  finishDrop() {
    const { dragStart, dragEnd } = this

    // We reset the drag first, just in case something goes wrong with the drop
    // below, the user can at least try to limp along and do another drag
    this.isDropping = false
    this.dragStart = undefined
    this.dragEnd = undefined

    this.onDroppingChange(false)

    if (!dragStart) {
      throw new Error("Could not find dragStart in dropping state")
    }

    if (!dragEnd) {
      throw new Error("Could not find dragEnd in dropping state")
    }

    if (dragEnd.parentId === undefined) {
      throw new Error(
        "In dropping state even though the drag ended outside the tree"
      )
    }

    this.notifyNodeOfChange(dragEnd.parentId, {
      placeholderOrder: null,
      expansion:
        dragEnd.parentId === null
          ? "expanded"
          : this.getExpansion(this.tree.nodesById[dragEnd.parentId].data),
    })

    const originalParentId = this.functions.getParentId(dragStart.node.data)

    this.notifyNodeOfChange(originalParentId, { isDropping: false })
  }
}

type DragStart<Datum> = {
  node: OrderedTreeNode<Datum>
  nodesByIndex?: Record<number, OrderedTreeNode<Datum>>
  indexesById?: Record<string, number>
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
  left: number
  height: number
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

type NodeChange = {
  expansion?: "expanded" | "collapsed" | "no children"
  placeholderOrder?: number | null
  isDropping?: boolean
}

export type NodeListener = (change: NodeChange) => void

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
