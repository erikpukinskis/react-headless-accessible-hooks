import { isEmpty } from "lodash"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { DatumFunctions, OrderedTreeNode } from "./buildTree"
import { buildTree } from "./buildTree"
import type { NodeListener } from "./OrderedTreeModel"
import { OrderedTreeModel } from "./OrderedTreeModel"
import type { DebugDataDumper } from "~/Debug"
import { makeUninitializedContext } from "~/helpers"

export type { DatumFunctions } from "./buildTree"

// moving down...
//  - if hoverNeed has (expanded) children, insert before first child of hoverNeed
//  - if targetDepth is higher than the hoverNeed depth, and hoverNeed is not collapsed, insert as first child of hoverNeed
//  - if hoverNeed is not a last child, insert after hoverNeed
//  - while there's a next parent, and next parent is a last child
//      - go to next parent
//  - if there was a parent, insert after that parent
//  - otherwise insert after hoverNeed

// moving up...
//  - if the target depth is higher than the hoverNeed depth...
//      - grab the hoverNeed - 1 parents (incl. hoverNeed - 1) starting at the target depth
//      - if the parent is a last child, insert after the parent
//      - keep doing down the parents (incl. hoverNeed - 1) until you get to a last child
//      - if the target depth is higher than hoverNeed - 1, and hoverNeed - 1 is not collapsed, add it as the only child of hoverNeed - 1
//  - otherwise insert before the hoverNeed

const OrderedTreeContext = createContext(
  makeUninitializedContext<OrderedTreeModel<unknown>>(
    "Cannot use OrderedTreeContext outside of an OrderedTreeProvider"
  )
)

function useModel<Datum>() {
  return useContext(OrderedTreeContext) as OrderedTreeModel<Datum>
}

type OrderedTreeProviderProps<Datum> = {
  children: React.ReactNode
  model: OrderedTreeModel<Datum>
}

function OrderedTreeProvider<Datum>({
  children,
  model,
}: OrderedTreeProviderProps<Datum>) {
  if (!model) {
    throw new Error("OrderedTreeProvider needs a model")
  }

  return (
    <OrderedTreeContext.Provider value={model}>
      {children}
    </OrderedTreeContext.Provider>
  )
}

export type UseOrderedTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  onNodeMove(id: string, newOrder: number, newParentId: string | null): void
  onBulkNodeOrder(ordersById: Record<string, number>): void
  dump?: DebugDataDumper
}

type GetTreeProps = () => React.HTMLAttributes<HTMLElement> & {
  ref(node: HTMLElement | null): void
}

type GetNodeProps = () => React.HTMLAttributes<HTMLElement>

type UseOrderedTreeReturnType<Datum> = {
  roots: Datum[]
  getTreeProps: GetTreeProps
  TreeProvider(this: void, props: { children: React.ReactNode }): JSX.Element
  getKey(this: void, datum: Datum): string
}

export function useOrderedTree<Datum>({
  data,

  // Datum functions
  getParentId,
  getId,
  getOrder,
  compare,
  isCollapsed,

  // Callbacks
  dump,
  onNodeMove,
  onBulkNodeOrder,
}: UseOrderedTreeArgs<Datum>): UseOrderedTreeReturnType<Datum> {
  const bulkOrderRef = useRef(onBulkNodeOrder)
  bulkOrderRef.current = onBulkNodeOrder

  const datumFunctions = useMemo(
    () => ({
      getParentId,
      getId,
      getOrder,
      compare,
      isCollapsed,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [tree, setTree] = useState(() =>
    buildTree({
      data,
      ...datumFunctions,
    })
  )

  const [model] = useState(
    () =>
      new OrderedTreeModel({
        tree: tree,
        getParentId,
        getOrder,
        getId,
        isCollapsed,
        dump,
        moveNode: onNodeMove,
        collapseNode: () => {},
        expandNode: () => {},
      })
  )

  const [TreeProvider] = useState(
    () =>
      function TreeProvider({ children }: { children: React.ReactNode }) {
        return (
          <OrderedTreeProvider model={model}>{children}</OrderedTreeProvider>
        )
      }
  )

  useEffect(() => {
    model.setMoveNode(onNodeMove)
  }, [model, onNodeMove])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => model.cleanup(), [])

  const { children: rootsWithPlaceholder } = useParent(
    tree.roots,
    null,
    model,
    false
  )

  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    if (isFirstRenderRef.current) {
      // We don't need to rebuild the tree on the first render
      isFirstRenderRef.current = false
      return
    }

    const newTree = buildTree({
      data,
      ...datumFunctions,
    })

    setTree(newTree)
    model.setTree(newTree)
  }, [data, model, datumFunctions])

  useEffect(() => {
    if (isEmpty(tree.missingOrdersById)) return

    bulkOrderRef.current(tree.missingOrdersById)
  }, [tree])

  const observedNodeRef = useRef<HTMLElement | null>(null)
  const [treeObserver] = useState(
    () =>
      new ResizeObserver(function updateTreeBox([{ contentRect }]) {
        if (!contentRect.width) {
          model.setTreeBox(undefined)
          return
        }

        model.setTreeBox({
          top: contentRect.top,
          height: contentRect.height,
          offsetLeft: contentRect.left,
          offsetTop: contentRect.top,
        })
      })
  )

  function callbackRef(element: HTMLElement | null) {
    if (observedNodeRef.current && observedNodeRef.current === element) {
      return
    }

    if (observedNodeRef.current && observedNodeRef.current !== element) {
      treeObserver.unobserve(observedNodeRef.current)
      observedNodeRef.current = null
    }

    if (!element) {
      model.setTreeBox(undefined)
      return
    }

    treeObserver.observe(element)
    observedNodeRef.current = element
  }

  function getTreeProps() {
    return {
      role: "tree",
      ref: callbackRef,
    }
  }

  function getKey(datum: Datum) {
    return model.getKey(datum)
  }

  return {
    roots: rootsWithPlaceholder,
    getTreeProps,
    TreeProvider,
    getKey,
  }
}

export function TreeProvider<Datum>({
  children,
  model,
}: {
  children: React.ReactNode
  model: OrderedTreeModel<Datum>
}) {
  return <OrderedTreeProvider model={model}>{children}</OrderedTreeProvider>
}

type UseOrderedTreeNodeReturnType<Datum> = {
  children: Datum[]
  getNodeProps: GetNodeProps
  depth: number
  isBeingDragged: boolean
  hasChildren: boolean
  expansion: "expanded" | "collapsed" | "no children"
  isPlaceholder: boolean
  getKey: (datum: Datum) => string
}

export function useOrderedTreeNode<Datum>(
  datum: Datum
): UseOrderedTreeNodeReturnType<Datum> {
  const model = useModel<Datum>()

  const node = model.getNode(datum)
  const isBeingDragged = model.isBeingDragged(node.id)
  const isPlaceholder = model.isPlaceholder(datum)
  const childIsBeingDragged = model.childIsBeingDragged(node.id)

  const { children, expansion } = useParent(
    node.children,
    node.data,
    model,
    isPlaceholder
  )

  const getNodeProps = useCallback<GetNodeProps>(() => {
    return {
      onMouseDown: model.handleMouseDown.bind(model, datum),
      role: "treeitem",
    }
  }, [model, datum])

  // TODO: do we want getPlaceholderProps with some of the above?
  // TODO: do we need key in the above?

  const depth = isPlaceholder
    ? model.getPlaceholderDepth()
    : node.parents.length

  const hasChildren =
    children.length > 1 || (children.length === 1 && !childIsBeingDragged)

  const getKey = useCallback((datum: Datum) => model.getKey(datum), [model])

  return {
    children,
    expansion,
    getNodeProps,
    depth,
    isBeingDragged,
    isPlaceholder,
    hasChildren,
    getKey,
  }
}

type UseParentReturnType<Datum> = {
  children: Datum[]
  expansion: "expanded" | "collapsed" | "no children"
}

/**
 * Returns state regarding a node, specifically the state which can change
 * during a drag.
 *
 * This includes the children, and whether a node is expanded or collapsed. A
 * node can be collapsed if you start dragging it, and a node can become
 * expanded if it has no children yet, and you drag another node under it as a
 * new child.
 */
function useParent<Datum>(
  childNodes: OrderedTreeNode<Datum>[],
  parent: Datum | null,
  model: OrderedTreeModel<Datum>,
  isPlaceholder: boolean
): UseParentReturnType<Datum> {
  const [placeholderOrder, setPlaceholderOrder] = useState<number | null>(null)
  const [droppedOrder, setDroppedOrder] = useState<number | null>(null)
  const [expansion, setExpansion] = useState(
    parent === null ? "expanded" : model.getExpansion(parent)
  )

  const parentId = parent ? model.data.getId(parent) : null

  useEffect(() => {
    if (isPlaceholder) return

    const handleNodeChange: NodeListener = (change) => {
      if (change.expansion !== undefined) {
        setExpansion(change.expansion)
      }
      if (change.placeholderOrder !== undefined) {
        setPlaceholderOrder(change.placeholderOrder)
      }
      if (change.droppedOrder !== undefined) {
        setDroppedOrder(change.droppedOrder)
      }
    }

    model.addPlaceholderListener(parentId, handleNodeChange)

    return () => {
      model.removePlaceholderListener(parentId, handleNodeChange)
    }
  }, [model, parentId, isPlaceholder])

  const children = useMemo(
    function buildChildNodes(): Datum[] {
      if (isPlaceholder) return []

      if (model.isIdle()) {
        return childNodes.map((node) => node.data)
      }

      if (placeholderOrder !== null) {
        const placeholderDatum = model.getPlaceholderDatum()

        if (!placeholderDatum) {
          throw new Error(
            "Could not get placeholder id, even though placeholder is included in these siblings"
          )
        }

        const data = spliceSibling(
          childNodes,
          model.getPlaceholderDatum(),
          placeholderOrder,
          model.getOrder.bind(model)
        )

        // assertUniqueKeys(data, model)

        return data
      } else if (droppedOrder !== null) {
        const droppedDatum = model.getDroppedDatum()

        if (!droppedDatum) {
          throw new Error(
            "Could not get placeholder id, even though placeholder is included in these siblings"
          )
        }

        const data = spliceSibling(
          childNodes,
          droppedDatum,
          droppedOrder,
          model.getOrder.bind(model)
        )

        // assertUniqueKeys(data, model)

        return data
      } else {
        return childNodes.map((node) => node.data)
      }
    },
    [isPlaceholder, model, placeholderOrder, droppedOrder, childNodes]
  )

  return {
    children,
    expansion,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assertUniqueKeys<Datum>(
  data: Datum[],
  model: OrderedTreeModel<Datum>
) {
  const keys: Record<string, boolean> = {}
  const duplicateKeys: string[] = []

  for (const datum of data) {
    const key = model.getKey(datum)
    if (keys[key]) {
      duplicateKeys.push(key)
    } else {
      keys[key] = true
    }
  }

  if (duplicateKeys.length > 0) {
    throw new Error(
      `Key${duplicateKeys.length > 1 ? "s" : ""} ${duplicateKeys.join(
        ","
      )} appear${
        duplicateKeys.length > 1 ? "" : "s"
      } twice in siblings: ${Object.keys(keys).join(",")}`
    )
  }
}

/**
 * Returns a copy of the provided nodes array with an additional node spliced in
 * based on the order provided
 */
function spliceSibling<Datum>(
  siblings: OrderedTreeNode<Datum>[],
  newSiblingDatum: Datum,
  order: number,
  getOrder: (datum: Datum) => number
) {
  let spliceIndex = 0
  while (
    spliceIndex < siblings.length &&
    getOrder(siblings[spliceIndex].data) < order
  ) {
    spliceIndex++
  }

  const data = siblings.map((node) => node.data)

  data.splice(spliceIndex, 0, newSiblingDatum)

  return data
}
