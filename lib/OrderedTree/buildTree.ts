import { orderBy } from "lodash"
import { assert } from "~/helpers"

export type DatumFunctions<Datum> = {
  getParentId(datum: Datum): string | null
  getId(datum: Datum): string
  compare(a: Datum, b: Datum): number
  getOrder(datum: Datum): number | null
  setOrder(datum: Datum, order: number): void
  isCollapsed(datum: Datum): boolean
}

type buildTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
}

export function buildTree<Datum>({
  data,
  ...datumFunctions
}: buildTreeArgs<Datum>) {
  console.log("\nBuilding tree")
  const rootData = data.filter((datum) => !datumFunctions.getParentId(datum))
  const nodesByIndex: Record<number, OrderedTreeNode<Datum>> = {}

  if (data.length > 0 && rootData.length < 1) {
    if (import.meta.env.MODE !== "test") {
      console.log(JSON.stringify(data, null, 4).slice(0, 500))
    }

    throw new Error(
      "Every node in the tree had a parent... there should be at least one root node?"
    )
  }

  const { nodes, missingOrders, nextIndex } = buildSiblingNodes({
    data,
    ...datumFunctions,
    siblingData: rootData,
    nextIndex: 0,
    nodesByIndex,
    parents: [],
  })

  return { roots: nodes, missingOrders, treeSize: nextIndex, nodesByIndex }
}

export type OrderedTreeNode<Datum> = {
  id: string
  key: string
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
  siblingData: Datum[]
  nextIndex: number
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  parents: OrderedTreeNode<Datum>[]
}

function buildSiblingNodes<Datum>({
  data,
  siblingData,
  getId,
  compare,
  getOrder,
  setOrder,
  getParentId,
  isCollapsed,
  nextIndex,
  nodesByIndex,
  parents,
}: BuildNodesArgs<Datum>) {
  const missingOrders: Record<string, number> = {}

  const { missingOrders: newmissingOrders, orderedData } = assignMissingOrder({
    siblingData,
    getId,
    compare,
    getOrder,
    setOrder,
  })

  Object.assign(missingOrders, newmissingOrders)

  const nodes = orderedData.map(function buildNode(
    datum,
    index
  ): OrderedTreeNode<Datum> {
    const childData = data.filter(
      (possibleChild) => getParentId(possibleChild) === getId(datum)
    )

    const nodeIndex = nextIndex

    nextIndex++

    const id = getId(datum)
    const parentId = getParentId(datum)
    const key = `${id}-under-${parentId ?? "root"}`

    const node: OrderedTreeNode<Datum> = {
      id,
      key,
      data: datum,
      order: assert(
        getOrder(datum),
        "Expected datum to have an order, but order was %s"
      ),
      children: [] as OrderedTreeNode<Datum>[],
      parents: parents,
      isLastChild: index === orderedData.length - 1,
      isCollapsed: childData.length > 0 && isCollapsed(datum),
      isPlaceholder: false,
      index: nodeIndex,
    }

    if (childData.length > 0 && !isCollapsed(datum)) {
      const {
        nodes: childNodes,
        missingOrders: moremissingOrders,
        nextIndex: newNextIndex,
      } = buildSiblingNodes({
        siblingData: childData,
        data,
        getParentId,
        getId,
        compare,
        getOrder,
        setOrder,
        isCollapsed,
        nextIndex,
        nodesByIndex,
        parents: [node, ...parents],
      })

      if (!isCollapsed(datum)) {
        node.children = childNodes
      }

      Object.assign(missingOrders, moremissingOrders)
      nextIndex = newNextIndex
    }

    nodesByIndex[nodeIndex] = node

    return node
  })

  return {
    nodes,
    missingOrders,
    nextIndex,
  }
}

type AssignMissingOrderArgs<Datum> = Pick<
  DatumFunctions<Datum>,
  "getId" | "getOrder" | "setOrder" | "compare"
> & {
  siblingData: Datum[]
}

export function assignMissingOrder<Datum>({
  siblingData,
  getId,
  getOrder,
  setOrder,
  compare,
}: AssignMissingOrderArgs<Datum>) {
  const missingOrders: Record<string, number> = {}

  function datumIsOrdered(datum: Datum) {
    return getOrder(datum) !== null
  }

  function datumIsNotOrdered(datum: Datum) {
    return getOrder(datum) === null
  }

  const orderedData = orderBy(
    siblingData.filter(datumIsOrdered),
    getOrder,
    "asc"
  )

  const unorderedData = siblingData.filter(datumIsNotOrdered)
  unorderedData.sort(compare)

  const firstOrder =
    orderedData.length < 1 ? 1 : (getOrder(orderedData[0]) as number)
  const orderGap = firstOrder / (unorderedData.length + 1)

  let nextOrder = orderGap
  for (const datum of unorderedData) {
    setOrder(datum, nextOrder)
    missingOrders[getId(datum)] = nextOrder
    nextOrder += orderGap
  }

  return {
    missingOrders,
    orderedData: [...unorderedData, ...orderedData],
  }
}

type PlaceWithinSiblingsArgs<Datum> = Pick<
  DatumFunctions<Datum>,
  "getOrder" | "getId"
> & {
  direction: "before" | "after"
  relativeToId: string
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
  getOrder,
  getId,
}: PlaceWithinSiblingsArgs<Datum>) {
  function getGuaranteedOrder(index: number) {
    const sibling = siblings[index]
    if (!sibling) {
      throw new Error(`No sibling at index ${index}`)
    }
    return assert(
      getOrder(sibling.data),
      `Can't call getOrder on an unordered datum (id ${getId(sibling.data)})`
    )
  }

  if (direction === "before") {
    const indexAfter = siblings.findIndex(
      (sibling) => getId(sibling.data) === relativeToId
    )
    const orderAfter = getGuaranteedOrder(indexAfter)
    const isFirst = indexAfter === 0
    const orderBefore = isFirst ? 0 : getGuaranteedOrder(indexAfter - 1)
    return orderBefore + (orderAfter - orderBefore) / 2
  } else {
    const indexBefore = siblings.findIndex(
      (sibling) => getId(sibling.data) === relativeToId
    )
    if (indexBefore < 0) {
      throw new Error("Could not find relative sibling in siblings array")
    }
    const orderBefore = getGuaranteedOrder(indexBefore)
    const isLast = indexBefore === siblings.length - 1
    const orderAfter = isLast ? 1 : getGuaranteedOrder(indexBefore + 1)
    return orderBefore + (orderAfter - orderBefore) / 2
  }
}
