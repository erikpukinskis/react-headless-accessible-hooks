import { orderBy } from "lodash"
import { assert } from "~/helpers"

export type DatumFunctions<Datum> = {
  getParentId(datum: Datum): string | null
  getId(datum: Datum): string
  getOrder(datum: Datum): number | null
  compare(a: Datum, b: Datum): number
  isCollapsed(datum: Datum): boolean
}

export type OrderedTreeBuild<Datum> = {
  roots: OrderedTreeNode<Datum>[]
  rootData: Datum[]
  treeSize: number
  // orphans: OrderedTreeNode<Datum>[]
  missingOrdersById: Record<string, number>
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  nodesById: Record<string, OrderedTreeNode<Datum>>
}

type buildTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
}

export function buildTree<Datum>({
  data,
  ...datumFunctions
}: buildTreeArgs<Datum>): OrderedTreeBuild<Datum> {
  console.log("Building tree")

  const rootData = data.filter((datum) => !datumFunctions.getParentId(datum))
  const nodesByIndex: Record<number, OrderedTreeNode<Datum>> = {}
  const nodesById: Record<string, OrderedTreeNode<Datum>> = {}

  if (data.length > 0 && rootData.length < 1) {
    if (import.meta.env.MODE !== "test") {
      console.log(JSON.stringify(data, null, 4).slice(0, 500))
    }

    throw new Error(
      "Every node in the tree had a parent... there should be at least one root node?"
    )
  }

  // OK here we probably need to be returning other stuff here instead of nodes

  const {
    nodes: roots,
    missingOrdersById,
    nextIndex,
  } = buildSiblingNodes({
    siblings: rootData,
    ...datumFunctions,
    data,
    nextIndex: 0,
    nodesByIndex,
    nodesById,
    parents: [],
  })

  const build: OrderedTreeBuild<Datum> = {
    roots,
    rootData,
    missingOrdersById,
    treeSize: nextIndex,
    nodesByIndex,
    nodesById,
  }

  return build
}

export type OrderedTreeNode<Datum> = {
  id: string
  data: Datum
  order: number
  children: OrderedTreeNode<Datum>[]
  parents: OrderedTreeNode<Datum>[]
  isLastChild: boolean
  isCollapsed: boolean
  isPlaceholder: boolean
  index: number
}

type BuildNodesArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  siblings: Datum[]
  nextIndex: number
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  nodesById: Record<string, OrderedTreeNode<Datum>>
  parents: OrderedTreeNode<Datum>[]
}

function buildSiblingNodes<Datum>({
  siblings,
  data,
  getId,
  getOrder,
  compare,
  getParentId,
  isCollapsed,
  nextIndex,
  nodesByIndex,
  nodesById,
  parents,
}: BuildNodesArgs<Datum>) {
  const missingOrdersById: Record<string, number> = {}

  const orderedSiblings = sortSiblings({
    siblings,
    missingOrdersById,
    getId,
    getOrder,
    compare,
  })

  const nodes = orderedSiblings.map(function buildNode(
    datum,
    index
  ): OrderedTreeNode<Datum> {
    const childData = data.filter(
      (possibleChild) => getParentId(possibleChild) === getId(datum)
    )

    const nodeIndex = nextIndex

    nextIndex++

    const id = getId(datum)

    const order =
      missingOrdersById[id] ??
      assert(
        getOrder(datum),
        "Expected datum to have an order, but order was %s"
      )

    /// This won't work, because we're no longer baking the missing orders into the tree
    /// And in fact we need to audit every call of getOrder because they're probably all wrong

    const node: OrderedTreeNode<Datum> = {
      id,
      data: datum,
      order,
      children: [] as OrderedTreeNode<Datum>[],
      parents: parents,
      isLastChild: index === orderedSiblings.length - 1,
      isCollapsed: childData.length > 0 && isCollapsed(datum),
      isPlaceholder: false,
      index: nodeIndex,
    }

    if (childData.length > 0 && !isCollapsed(datum)) {
      const {
        nodes: childNodes,
        missingOrdersById: moreMissingOrders,
        nextIndex: newNextIndex,
      } = buildSiblingNodes({
        siblings: childData,
        data,
        getParentId,
        getId,
        compare,
        getOrder,
        isCollapsed,
        nextIndex,
        nodesByIndex,
        nodesById,
        parents: [node, ...parents],
      })

      if (!isCollapsed(datum)) {
        node.children = childNodes
      }

      Object.assign(missingOrdersById, moreMissingOrders)
      nextIndex = newNextIndex
    }

    nodesByIndex[nodeIndex] = node
    nodesById[id] = node

    return node
  })

  return {
    nodes,
    missingOrdersById,
    nextIndex,
  }
}

type AssignMissingOrderArgs<Datum> = Pick<
  DatumFunctions<Datum>,
  "getId" | "getOrder" | "compare"
> & {
  missingOrdersById: Record<string, number>
  siblings: Datum[]
}

export function sortSiblings<Datum>({
  siblings,
  missingOrdersById,
  getId,
  getOrder,
  compare,
}: AssignMissingOrderArgs<Datum>) {
  function datumIsOrdered(datum: Datum) {
    return getOrder(datum) !== null
  }

  function datumIsNotOrdered(datum: Datum) {
    return getOrder(datum) === null
  }

  const orderedData = orderBy(siblings.filter(datumIsOrdered), getOrder, "asc")

  const unorderedData = siblings.filter(datumIsNotOrdered)
  unorderedData.sort(compare)

  const firstOrder =
    orderedData.length < 1 ? 1 : (getOrder(orderedData[0]) as number)
  const orderGap = firstOrder / (unorderedData.length + 1)

  let nextOrder = orderGap
  for (const datum of unorderedData) {
    missingOrdersById[getId(datum)] = nextOrder
    nextOrder += orderGap
  }

  return [...unorderedData, ...orderedData]
}

type PlaceWithinSiblingsArgs<Datum> = Pick<
  DatumFunctions<Datum>,
  "getOrder" | "getId"
> & {
  direction: "before" | "after" | "first-child"
  relativeToId?: string
  missingOrdersById: Record<string, number>
  siblings: OrderedTreeNode<Datum>[]
}

/**
 * Returns a new `order` for a node before or after another node in a list of
 * siblings.
 *
 * Currently spaces out the `order` by dividing available space by two, so if
 * you place a new node after a node with an `order` of `0.5` it would get an
 * order of `0.75`. The next one would be `0.875`, etc.
 *
 * This makes the math really easy to understand, which is nice, but it leads to
 * a pretty rapid loss of precision, especially as the `order` approaches `1`.
 * You can hit precision issues after only about 64 drags to the end of the
 * list.
 *
 * So we should probably use some kind of curve, where as you get closer to `0`
 * or `1` we start shifting the order by smaller and smaller values.
 *
 * We could just always go `Number.EPSILON` every time, which give us the
 * maximum amount of space. But then all of the orders would be like
 * `0.49999999999999`, `0.500000000000001`, `0.500000000002`, etc which would
 * just make things a little harder to grok. It seems nicer if we have somewhat
 * distinguishable values in the normal case, like `0.875`, `0.882`, `0.890`,
 * etc. A curve would allow us to get millions of available order changes, so we
 * could probably just not implement defragmentation, we could keep these
 * relatively readable numbers most of the time.
 *
 * The other possibility though would be to just implement defragmentation. That
 * would be truly bulletproof, and would let us keep this easy to understand
 * algorithm.
 */
export function placeWithinSiblings<Datum>({
  direction,
  relativeToId,
  siblings,
  missingOrdersById,
  getOrder,
  getId,
}: PlaceWithinSiblingsArgs<Datum>) {
  function getGuaranteedOrder(index: number) {
    const sibling = siblings[index]
    if (!sibling) {
      throw new Error(`No sibling at index ${index}`)
    }

    return assert(
      missingOrdersById[sibling.id] ?? getOrder(sibling.data),
      `Can't place a datum within unordered siblings (sibling id ${getId(
        sibling.data
      )} is unordered)`
    )
  }

  if (direction === "first-child") {
    if (siblings.length === 0) return 0.5

    const previousFirstChildOrder = getGuaranteedOrder(0)

    return previousFirstChildOrder / 2
  }

  const relativeIndex = siblings.findIndex(
    (sibling) => getId(sibling.data) === relativeToId
  )

  if (relativeIndex < 0) {
    throw new Error(
      `Could not find relative sibling ${
        relativeToId ?? "undefined"
      } in siblings array`
    )
  }

  if (direction === "before") {
    const indexAfter = relativeIndex
    const orderAfter = getGuaranteedOrder(indexAfter)
    const isFirst = indexAfter === 0
    const orderBefore = isFirst ? 0 : getGuaranteedOrder(indexAfter - 1)

    return orderBefore + (orderAfter - orderBefore) / 2
  } else if (direction === "after") {
    const indexBefore = relativeIndex
    const orderBefore = getGuaranteedOrder(indexBefore)
    const isLast = indexBefore === siblings.length - 1
    const orderAfter = isLast ? 1 : getGuaranteedOrder(indexBefore + 1)

    return orderBefore + (orderAfter - orderBefore) / 2
  } else {
    throw new Error(`Bad direction ${direction}`)
  }
}
