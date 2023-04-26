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
import type { PlaceholderListener } from "./OrderedTreeModel"
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

  const rootsWithPlaceholder = useChildData(tree.roots, null, model, false)

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

  function getTreeProps() {
    return {
      role: "tree",
      ref(node: HTMLElement) {
        if (!node) {
          model.setTreeBox(undefined)
          return
        }

        const rect = node.getBoundingClientRect()

        if (!rect.width) {
          model.setTreeBox(undefined)
          return
        }

        model.setTreeBox({
          top: rect.top,
          height: rect.height,
          offsetLeft: node.offsetLeft,
          offsetTop: node.offsetTop,
        })
      },
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
  isExpanded: boolean
  isCollapsed: boolean
  isPlaceholder: boolean
  getKey: (datum: Datum) => string
}

export function useOrderedTreeNode<Datum>(
  datum: Datum
): UseOrderedTreeNodeReturnType<Datum> {
  const model = useModel<Datum>()
  const node = model.getNode(datum)
  const isPlaceholder = model.isPlaceholder(datum)
  const children = useChildData(node.children, node.id, model, isPlaceholder)

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

  const childIsBeingDragged = model.childIsBeingDragged(node.id)

  const hasChildren =
    children.length > 1 || (children.length === 1 && !childIsBeingDragged)

  const getKey = useCallback((datum: Datum) => model.getKey(datum), [model])

  return {
    children,
    getNodeProps,
    depth,
    isBeingDragged: model.isBeingDragged(node.id),
    isExpanded: model.isExpanded(node.id),
    isCollapsed: model.isCollapsed(node.id),
    isPlaceholder: model.isPlaceholder(datum),
    hasChildren,
    getKey,
  }
}

function useChildData<Datum>(
  children: OrderedTreeNode<Datum>[],
  parentId: string | null,
  model: OrderedTreeModel<Datum>,
  isPlaceholder: boolean
): Datum[] {
  const [placeholderOrder, setPlaceholderOrder] = useState<number | undefined>(
    undefined
  )

  useEffect(() => {
    if (isPlaceholder) return

    const handlePlaceholderChange: PlaceholderListener = (
      isIncludedNow,
      order
    ) => {
      setPlaceholderOrder(isIncludedNow ? order : undefined)
    }

    model.addPlaceholderListener(parentId, handlePlaceholderChange)

    return () => {
      model.removePlaceholderListener(parentId, handlePlaceholderChange)
    }
  }, [model, parentId, isPlaceholder])

  return useMemo(
    function buildChildNodes(): Datum[] {
      if (isPlaceholder) return []

      if (!model.dragStart) {
        return children.map((node) => node.data)
      }

      if (placeholderOrder === undefined) {
        return children.map((node) => node.data)
      }

      // if (placeholderOrder === undefined) {
      //   throw new Error(
      //     "Do not have placeholder order, even though placeholder is included in these siblings"
      //   )
      // }

      const placeholderDatum = model.getPlaceholderData()

      if (!placeholderDatum) {
        throw new Error(
          "Could not get placeholder id, even though placeholder is included in these siblings"
        )
      }
      const data = splicePlaceholder(
        children,
        model.getPlaceholderData(),
        placeholderOrder,
        model.getOrder.bind(model)
      )

      // assertUniqueKeys(data, model)

      return data
    },
    [model, children, placeholderOrder, isPlaceholder]
  )
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
 * based on the provided order
 */
function splicePlaceholder<Datum>(
  siblings: OrderedTreeNode<Datum>[],
  placeholderDatum: Datum,
  placeholderOrder: number,
  getOrder: (datum: Datum) => number
) {
  let spliceIndex = 0
  while (
    spliceIndex < siblings.length &&
    getOrder(siblings[spliceIndex].data) < placeholderOrder
  ) {
    spliceIndex++
  }

  const data = siblings.map((node) => node.data)

  data.splice(spliceIndex, 0, placeholderDatum)

  return data
}
