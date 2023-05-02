import type { OrderedTreeNode } from "./buildTree"

const MAX_LOOP = 10

type Direction = "up" | "down" | "nowhere"

export type DragData<Datum> = {
  dragging: boolean
  dx: number | undefined
  downNode?: OrderedTreeNode<Datum>
  dragDirection: Direction
  downDepth?: number
  hoverDepth?: number
  targetDepth?: number
  roundedTargetDepth?: number
  relativeTo?: OrderedTreeNode<Datum>
  move: "before" | "after" | "nowhere" | "first-child"
  hoverNode?: OrderedTreeNode<Datum>
}

type GetDragArgs<Datum> = {
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  downIndex: number
  hoverIndex: number
  dx?: number
  dy?: number
  isCollapsed: (datum: Datum) => boolean
  isLastChild: (id: string) => boolean
}

export function getDrag<Datum>({
  nodesByIndex,
  downIndex,
  hoverIndex,
  dx,
  dy,
  isCollapsed,
  isLastChild,
}: GetDragArgs<Datum>): DragData<Datum> {
  if (downIndex == null) {
    throw new Error(
      `getDrag requires a downIndex, you passed ${JSON.stringify(downIndex)}`
    )
  }

  if (dx === 0 && dy === 0) {
    return {
      dragging: false,
      dragDirection: "nowhere",
      move: "nowhere",
      dx,
    }
  }

  const dragging = hoverIndex != null && downIndex != null

  const data: DragData<Datum> = {
    dragging,
    dragDirection: "nowhere",
    move: "nowhere",
    dx,
  }

  const hoverNode = nodesByIndex[hoverIndex]

  if (!hoverNode) return data

  data.hoverNode = hoverNode

  const dragDirection = (() => {
    if (!dragging) return "nowhere"
    else if (hoverIndex === downIndex) return "nowhere"
    else if (hoverIndex < downIndex) return "up"
    else return "down"
  })()

  data.dragDirection = dragDirection

  data.hoverDepth = hoverNode.parents.length

  if (dx == null) return data

  const downNode = nodesByIndex[downIndex]

  data.downNode = downNode

  // 1. Step 1 is to find a node above where we want to insert. We take care of
  //    the one remaining case where we're not below another node (inserting
  //    before the first item in the list.)

  let nodeAbove: OrderedTreeNode<Datum>

  if (dragDirection === "down") {
    nodeAbove = hoverNode
  } else {
    // Whether we're dragging up or nowhere, the result is the same: we want the
    // node to be below the node above where we're hovering:
    const previousNode = nodesByIndex[hoverIndex - 1]

    if (!previousNode && dragDirection === "nowhere") {
      // We're dragging sideways on the first node in the list, this does nothing
      return {
        ...data,
        move: "nowhere",
      }
    }

    if (!previousNode) {
      // We're dragging up above the first item in the list, which we are hovering over
      return {
        ...data,
        move: "before",
        relativeTo: hoverNode,
      }
    }

    nodeAbove = previousNode
  }

  // 2. Now we know we're below the node in data.relativeTo. And we will default
  //    to inserting after that node, we just need to handle these additional
  //    situations:
  //
  //      a. inserting as a child of data.relativeTo
  //
  //      b. inserting after one of data.relativeTo's parents
  //
  //      c. dragging nowhere at all
  //
  //    ... what we do here depends on the targetDepth

  const relativeDepth = nodeAbove.parents.length /// let's change this to nodeAboveDepth
  const downDepth = (data.downDepth = downNode.parents.length)
  const drift = dx / 40
  const rawTargetDepth = downDepth + drift
  const targetDepth = Math.max(
    0,
    Math.min(Math.round(rawTargetDepth), relativeDepth + 1)
  )

  data.targetDepth = rawTargetDepth
  data.roundedTargetDepth = targetDepth

  // If we're dragging farther right than the depth of the row above, we should
  // be able to insert as the first child (assuming it's not a collapsed node)
  if (targetDepth > relativeDepth && !isCollapsed(nodeAbove.data)) {
    return {
      ...data,
      move: "first-child",
      relativeTo: nodeAbove,
    }
  }

  const draggingOnlyChild =
    nodeAbove.children.length === 1 && nodeAbove.children[0].id === downNode.id

  // If the node above where we're dragging has children, we should be able to
  // insert above the first child, as long as we're not dragging the first
  // child!
  if (nodeAbove.children.length > 0 && !draggingOnlyChild) {
    return {
      ...data,
      move: "first-child",
      relativeTo: nodeAbove,
    }
  }

  // Otherwise we want to insert after the node above (or one of its parents)
  const bestAncestor = getAncestorClosestToDepth(
    targetDepth,
    nodeAbove,
    isLastChild
  )

  return {
    ...data,
    move: "after",
    relativeTo: bestAncestor,
  }
}

function getAncestorClosestToDepth<Datum>(
  targetDepth: number,
  node: OrderedTreeNode<Datum>,
  isLastChild: (id: string) => boolean
) {
  const ancestors = getAncestorChain(node, targetDepth)

  if (ancestors.length < 1) {
    throw new Error("Ancestor chain always needs at least one node")
  }

  let ancestorIndex = 0

  // Starting from the ancestor at the target depth, try to find an ancestor
  // that's a last sibling so we can insert after it
  for (let loop = targetDepth; loop <= MAX_LOOP; loop++) {
    const ancestor = ancestors[ancestorIndex]

    const baby = ancestors[ancestorIndex + 1]

    if (!baby) {
      // There are no more ancestors after this, so the current ancestor is the
      // node above the hover node, and none of the parents are suitable
      // relative nodes, so this ancestor is the best we can do.
      return ancestor
    }

    /// This doesn't work if the drag node is the last child. It's still a "last child"
    if (isLastChild(baby.id)) {
      // The ancestor is a good depth, and there are no more siblings below
      // here, so we can insert after the ancestor
      return ancestor
    }

    // Keep trying
    ancestorIndex++
  }

  throw new Error(`We don't support need depths greater than ${MAX_LOOP}`)
}

/**
 * Returns an array of parents for a given node, plus the node itself, starting
 * at a target depth.
 *
 * So if the parents array for "node" is ["mom", "grandma", "gamgam"] then
 * "gamgam" is at depth 0, "grandma" is depth 1, "mom" is depth 2, and "node" is
 * depth 3.
 *
 * If the targetDepth is 1 then `getAncestorChain` will return an array in the
 * opposite order starting at the target depth: ["grandma", "mom", "node"]
 */
export function getAncestorChain<Datum>(
  node: OrderedTreeNode<Datum>,
  targetDepth: number
) {
  const nodeDepth = node.parents.length

  if (targetDepth >= nodeDepth) return [node]

  const ancestorsStartingAtTargetDepth = []

  let loops = 0

  for (let depth = targetDepth; depth < nodeDepth; depth++) {
    loops++
    if (loops > MAX_LOOP) {
      throw new Error("Infinite loop?")
    }

    // The last parent is always at depth 0. So if there are three parents, that
    // one is index 2 which is the array length minus 1. The parent at depth 1
    // would be that minus one (minus the depth.)
    const parentIndex = node.parents.length - depth - 1

    ancestorsStartingAtTargetDepth.push(node.parents[parentIndex])
  }

  ancestorsStartingAtTargetDepth.push(node)

  return ancestorsStartingAtTargetDepth
}
