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

  const rawTargetDepth = (data.targetDepth = downDepth + drift)

  const targetDepth = (data.roundedTargetDepth = Math.max(
    0,
    Math.min(Math.round(rawTargetDepth), hoverDepth + 1)
  ))

  // either we are dragging sideways...

  if (dragDirection === "nowhere") {
    const nodeAbove = nodesByIndex[hoverIndex - 1]

    if (!nodeAbove || nodeAbove.isCollapsed || targetDepth === hoverDepth) {
      return {
        ...data,
        move: "nowhere",
      }
    }

    // debugger

    return {
      ...data,
      move: "first-child",
      relativeTo: nodeAbove,
    }
  }

  // or we're dragging down...

  if (dragDirection === "down") {
    // if hoverNeed has (expanded) children, insert before first child of hoverNeed
    if (hoverNode.children.length > 0) {
      return {
        ...data,
        move: "before",
        relativeTo: hoverNode.children[0],
      }
    }

    //  if targetDepth is higher than the hoverNeed depth, and hoverNeed is not collapsed, insert as first child of hoverNeed
    if (targetDepth > hoverDepth && !hoverNode.isCollapsed) {
      return {
        ...data,
        move: "first-child",
        relativeTo: hoverNode,
      }
    }

    // if hoverNeed is not a last sibling, insert after hoverNeed
    if (!hoverNode.isLastChild) {
      return {
        ...data,
        move: "after",
        relativeTo: hoverNode,
      }
    }

    const bestParent = getAncestorClosestToDepth(targetDepth, hoverNode)

    return {
      ...data,
      move: "after",
      relativeTo: bestParent,
    }
  }

  // otherwise we are dragging up...

  const previousNode = nodesByIndex[hoverIndex - 1]

  //  if the target depth is higher than the hoverNeed depth,
  //    1. grab the hoverNode - 1 parents (incl. hoverNeed - 1) starting at the
  //       target depth
  //    2. if the parent is a last child, insert after the parent
  //    3. keep doing down the parents (incl. hoverNeed - 1) until you get to a
  //       last child
  //    4. if the target depth is higher than hoverNeed - 1, and hoverNeed - 1
  //       is not collapsed, add it as the only child of hoverNeed - 1
  if (targetDepth > hoverDepth && previousNode) {
    const bestParent = getAncestorClosestToDepth(targetDepth, previousNode)

    return {
      ...data,
      move: "after",
      relativeTo: bestParent,
    }
  }

  // otherwise insert before the hoverNeed:
  return {
    ...data,
    move: "before",
    relativeTo: hoverNode,
  }
}

function getAncestorClosestToDepth(
  depth: number,
  node: OrderedTreeNode<unknown>
) {
  const ancestors = getAncestorChain(node, depth)

  let ancestorIndex = 0

  // Starting from the ancestor at the target depth, try to find an ancestor
  // that's a last sibling. Otherwise return the hoverNeed.
  for (let loop = 10; loop <= 10; loop++) {
    const ancestor = ancestors[ancestorIndex]

    if (!ancestor) {
      debugger
    }
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

  if (targetDepth > nodeDepth) return []

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
