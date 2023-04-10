import type { OrderedTreeNode } from "./buildTree"

type Direction = "up" | "down" | "nowhere"

export type DragData = {
  dragging: boolean
  dx: number | undefined
  downNode?: OrderedTreeNode<unknown>
  dragDirection: Direction
  downDepth?: number
  hoverDepth?: number
  targetDepth?: number
  roundedTargetDepth?: number
  relativeTo?: OrderedTreeNode<unknown>
  move: "before" | "after" | "nowhere" | "first-child"
  hoverNode?: OrderedTreeNode<unknown>
}

export function getDrag<Datum>(
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>,
  downRowIndex: number | undefined,
  hoverIndex: number,
  dx: number | undefined,
  dy: number | undefined
): DragData {
  if (dx === 0 && dy === 0) {
    return {
      dragging: false,
      dragDirection: "nowhere",
      move: "nowhere",
      dx,
    }
  }

  const dragging = hoverIndex != null && downRowIndex != null

  const data: DragData = {
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
    else if (hoverIndex === downRowIndex) return "nowhere"
    else if (hoverIndex < downRowIndex) return "up"
    else return "down"
  })()

  data.dragDirection = dragDirection

  const hoverDepth = (data.hoverDepth = hoverNode.parents.length)

  if (downRowIndex == null || dx == null) return data

  const downNode = nodesByIndex[downRowIndex]

  data.downNode = downNode

  const downDepth = (data.downDepth = downNode.parents.length)
  const drift = dx / 40
  const rawTargetDepth = downDepth + drift

  data.targetDepth = rawTargetDepth

  const targetDepth = Math.max(
    0,
    Math.min(Math.round(rawTargetDepth), hoverDepth + 1)
  )

  data.roundedTargetDepth = targetDepth

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

  const relativeDepth = nodeAbove.parents.length

  if (targetDepth > relativeDepth && !nodeAbove.isCollapsed) {
    return {
      ...data,
      move: "first-child",
      relativeTo: nodeAbove,
    }
  }

  const draggingOnlyChild =
    nodeAbove.children.length === 1 && nodeAbove.children[0].id === downNode.id

  if (nodeAbove.children.length > 0 && !draggingOnlyChild) {
    return {
      ...data,
      move: "first-child",
      relativeTo: nodeAbove,
    }
  }

  const bestAncestor = getAncestorClosestToDepth(targetDepth, nodeAbove)

  return {
    ...data,
    move: "after",
    relativeTo: bestAncestor,
  }
}

function getAncestorClosestToDepth(
  depth: number,
  node: OrderedTreeNode<unknown>
) {
  const ancestors = getAncestorChain(node, depth)

  if (ancestors.length < 1) {
    throw new Error("Ancestor chain always needs at least one node")
  }

  let ancestorIndex = 0

  // Starting from the ancestor at the target depth, try to find an ancestor
  // that's a last sibling. Otherwise return the hoverNeed.
  for (let loop = 10; loop <= 10; loop++) {
    const ancestor = ancestors[ancestorIndex]

    if (ancestor.isLastChild) break

    if (!ancestors[ancestorIndex + 1]) break
    ancestorIndex++

    if (loop === 10) {
      throw new Error("We don't support need depths greater than 10")
    }
  }

  return ancestors[ancestorIndex]
}

const MAX_LOOP = 10

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
export function getAncestorChain(
  node: OrderedTreeNode<unknown>,
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
