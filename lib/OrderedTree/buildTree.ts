import { compact, keyBy, orderBy } from "lodash"
import { assert } from "~/helpers"

export type DatumFunctions<Datum> = {
  getParentId(this: void, datum: Datum): string | null
  getId(this: void, datum: Datum): string
  getOrder(this: void, datum: Datum): number | null
  compare(this: void, a: Datum, b: Datum): number
  isCollapsed(this: void, datum: Datum): boolean
  isFilteredOut?(this: void, datum: Datum): boolean | undefined
}

export type OrderedTreeBuild<Datum> = Readonly<{
  roots: OrderedTreeNode<Datum>[]
  rootData: Datum[]
  orphanData: Datum[]
  treeSize: number
  missingOrdersById: Record<string, number>
  expansionOverrides: Record<string, "expanded" | "collapsed" | undefined>
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  nodesById: Record<string, OrderedTreeNode<Datum>>
  indexesById: Record<string, number>
}>

type BuildTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  expansionOverrideMask: Record<string, "masked" | undefined>
}

export function buildTree<Datum>({
  data,
  expansionOverrideMask,
  isFilteredOut,
  ...datumFunctions
}: BuildTreeArgs<Datum>): OrderedTreeBuild<Datum> {
  console.log("Building tree")
  const nodesByIndex: Record<number, OrderedTreeNode<Datum>> = {}
  const nodesById: Record<string, OrderedTreeNode<Datum>> = {}
  const indexesById: Record<string, number> = {}

  const { hasChildrenFilteredIn, rootData, orphanData, expansionOverrides } =
    prebuildTree({
      data,
      isFilteredOut,
      getParentId: datumFunctions.getParentId,
      getId: datumFunctions.getId,
      isCollapsed: datumFunctions.isCollapsed,
    })

  const isCollapsed = (datum: Datum) => {
    const id = datumFunctions.getId(datum)

    if (!expansionOverrides[id] || expansionOverrideMask[id] === "masked") {
      return datumFunctions.isCollapsed(datum)
    }

    return expansionOverrides[id] === "collapsed" ? true : false
  }

  const { nodes, missingOrdersById, nextIndex } = buildSiblingNodes({
    hasChildrenFilteredIn,
    siblings: rootData,
    ...datumFunctions,
    isCollapsed,
    data,
    nextIndex: 0,
    nodesByIndex,
    nodesById,
    indexesById,
    parents: [],
  })

  const build: OrderedTreeBuild<Datum> = {
    roots: nodes,
    orphanData,
    rootData,
    missingOrdersById,
    expansionOverrides,
    treeSize: nextIndex,
    nodesByIndex,
    nodesById,
    indexesById,
  }

  return build
}

type PrebuildTreeArgs<Datum> = Pick<
  DatumFunctions<Datum>,
  "isFilteredOut" | "getParentId" | "getId" | "isCollapsed"
> & {
  data: Datum[]
}

export function prebuildTree<Datum>({
  data,
  isFilteredOut,
  getParentId,
  getId,
  isCollapsed,
}: PrebuildTreeArgs<Datum>) {
  const dataById = keyBy(data, getId)
  const hasChildrenFilteredIn: Record<string, boolean> = {}

  for (const datum of data) {
    if (!isFilteredOut) {
      hasChildrenFilteredIn[getId(datum)] = true
      continue
    }

    if (isFilteredOut(datum)) continue

    hasChildrenFilteredIn[getId(datum)] = true

    let parentId = getParentId(datum)

    let depth = 0
    while (parentId && depth <= 10) {
      hasChildrenFilteredIn[parentId] = true

      if (depth === 10) {
        throw new Error("Tree can only be 10 nodes deep")
      }

      depth++

      const nextParent = dataById[parentId]

      if (!nextParent) {
        break
      }

      parentId = getParentId(nextParent)
    }
  }

  const expansionOverrides = isFilteredOut
    ? findExpansionOverrides({
        data,
        hasChildrenFilteredIn,
        getId,
        isCollapsed,
      })
    : {}

  const rootData = []
  const orphanData = []

  for (const datum of data) {
    const parentId = getParentId(datum)
    const isRoot = parentId === null

    if (parentId && !dataById[parentId]) {
      orphanData.push(datum)
      continue
    }

    if (isRoot && hasChildrenFilteredIn[getId(datum)]) {
      rootData.push(datum)
    }
  }

  return { hasChildrenFilteredIn, rootData, orphanData, expansionOverrides }
}

type FindExpansionOverridesArgs<Datum> = {
  data: Datum[]
  hasChildrenFilteredIn: Record<string, boolean>
  getId(datum: Datum): string
  isCollapsed(datum: Datum): boolean
}

function findExpansionOverrides<Datum>({
  data,
  hasChildrenFilteredIn,
  getId,
  isCollapsed,
}: FindExpansionOverridesArgs<Datum>) {
  const expansionOverrides: Record<
    string,
    "expanded" | "collapsed" | undefined
  > = {}

  for (const datum of data) {
    const filteredIn = hasChildrenFilteredIn[getId(datum)]
    const collapsed = isCollapsed?.(datum)

    if (collapsed && filteredIn) {
      expansionOverrides[getId(datum)] = "expanded"
    }

    if (!collapsed && !filteredIn) {
      expansionOverrides[getId(datum)] = "collapsed"
    }
  }

  return expansionOverrides
}

export type OpenOrderedTreeNode<Datum> = {
  id: string
  data: Datum
  children: OrderedTreeNode<Datum>[]
  parents: OrderedTreeNode<Datum>[]
  hasCollapsedChildren: boolean
}

export type OrderedTreeNode<Datum> = Readonly<OpenOrderedTreeNode<Datum>>

type BuildNodesArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  siblings: Datum[]
  nextIndex: number
  nodesByIndex: Record<number, OrderedTreeNode<Datum>>
  nodesById: Record<string, OrderedTreeNode<Datum>>
  indexesById: Record<string, number>
  parents: OrderedTreeNode<Datum>[]
  hasChildrenFilteredIn: Record<string, boolean>
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
  hasChildrenFilteredIn,
  nodesByIndex,
  indexesById,
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
    datum
  ): OrderedTreeNode<Datum> | undefined {
    const childData = data.filter((possibleChild) => {
      return getParentId(possibleChild) === getId(datum)
      // if (!isFilteredOut) return true
      // if (!hasChildrenFilteredIn[getId(possibleChild)]) return false
      // return true
    })

    const nodeIndex = nextIndex

    nextIndex++

    const id = getId(datum)

    const node: OpenOrderedTreeNode<Datum> = {
      id,
      data: datum,
      children: [] as OrderedTreeNode<Datum>[],
      parents: parents,
      hasCollapsedChildren: childData.length > 0 && isCollapsed(datum),
    }

    if (childData.length > 0 && !isCollapsed(datum)) {
      const {
        nodes: childNodes,
        missingOrdersById: moreMissingOrders,
        nextIndex: newNextIndex,
      } = buildSiblingNodes({
        siblings: childData,
        data,
        hasChildrenFilteredIn,
        getParentId,
        getId,
        compare,
        getOrder,
        isCollapsed,
        nextIndex,
        nodesByIndex,
        nodesById,
        indexesById,
        parents: [node, ...parents],
      })

      node.children = childNodes

      Object.assign(missingOrdersById, moreMissingOrders)

      nextIndex = newNextIndex
    }

    nodesByIndex[nodeIndex] = node
    nodesById[id] = node
    indexesById[id] = nodeIndex

    return node as OrderedTreeNode<Datum>
  })

  return {
    nodes: compact(nodes),
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
    throw new Error(`Bad direction ${direction as string}`)
  }
}

export function buildTreeIndexesWithNodeCollapsed<Datum>(
  tree: OrderedTreeBuild<Datum>,
  node: OrderedTreeNode<Datum>
) {
  const spliceStart = tree.indexesById[node.id] + 1
  const spliceLength = node.children.length

  const newNodesByIndex: Record<number, OrderedTreeNode<Datum>> = {}
  const newIndexesById: Record<string, number> = {}

  for (let newIndex = 0; newIndex < tree.treeSize - spliceLength; newIndex++) {
    const treeIndex =
      newIndex < spliceStart ? newIndex : newIndex + spliceLength
    const node = tree.nodesByIndex[treeIndex]

    newNodesByIndex[newIndex] = node
    newIndexesById[node.id] = newIndex
  }

  return { nodesByIndex: newNodesByIndex, indexesById: newIndexesById }
}
