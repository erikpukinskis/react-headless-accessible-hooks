import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { DatumFunctions, OrderedTreeNode } from "./buildTree"
import { buildTree } from "./buildTree"
import type { PlaceholderListener } from "./OrderedTreeModel"
import { OrderedTreeModel } from "./OrderedTreeModel"
import type { DebugDataDumper } from "~/Debug"
import { makeUninitializedContext, assert } from "~/helpers"

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
  moveNode(id: string, newOrder: number, newParentId: string | null): void
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
  moveNode,
}: UseOrderedTreeArgs<Datum>): UseOrderedTreeReturnType<Datum> {
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

  const [tree, setTree] = useState(function getTreeState() {
    return buildTree({
      data,
      ...datumFunctions,
    })
  })

  const [model] = useState(
    () =>
      new OrderedTreeModel({
        tree: tree,
        getParentId,
        getOrder,
        getId,
        dump,
        moveNode,
        collapseNode: () => {},
        expandNode: () => {},
      })
  )

  useEffect(() => {
    model.setMoveNode(moveNode)
  }, [model, moveNode])

  const rootsWithPlaceholder = useChildData(tree.roots, null, model, false)

  useEffect(() => {
    const newTree = buildTree({
      data,
      ...datumFunctions,
    })

    setTree(newTree)
    model.setTree(newTree)
  }, [data, model, datumFunctions])

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

  function TreeProvider(
    this: void,
    { children }: { children: React.ReactNode }
  ) {
    return <OrderedTreeProvider model={model}>{children}</OrderedTreeProvider>
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

type UseOrderedTreeNodeReturnType<Datum> = {
  children: Datum[]
  getNodeProps: GetNodeProps
  depth: number
  isBeingDragged: boolean
  hasChildren: boolean
  isExpanded: boolean
  isCollapsed: boolean
  isPlaceholder: boolean
  key: string
}

export function useOrderedTreeNode<Datum>(
  datum: Datum
): UseOrderedTreeNodeReturnType<Datum> {
  const model = useModel<Datum>()
  const node = model.getNode(datum)
  const isPlaceholder = model.isPlaceholder(datum)
  const children = useChildData(node.children, node.id, model, isPlaceholder)
  const key = model.getKey(datum)

  const getNodeProps = useCallback<GetNodeProps>(() => {
    return {
      onMouseDown: model.handleMouseDown.bind(model, datum),
      key,
      role: "treeitem",
    }
  }, [model, key, datum])

  const depth = isPlaceholder
    ? model.getPlaceholderDepth()
    : node.parents.length

  const childIsBeingDragged = model.childIsBeingDragged(node.id)

  const hasChildren =
    children.length > 1 || (children.length === 1 && !childIsBeingDragged)

  return {
    key,
    children,
    getNodeProps,
    depth,
    isBeingDragged: model.isBeingDragged(node.id),
    isExpanded: model.isExpanded(node.id),
    isCollapsed: model.isCollapsed(node.id),
    isPlaceholder: model.isPlaceholder(datum),
    hasChildren,
  }
}

function useChildData<Datum>(
  children: OrderedTreeNode<Datum>[],
  parentId: string | null,
  model: OrderedTreeModel<Datum>,
  isPlaceholder: boolean
): Datum[] {
  const [placeholderIsIncluded, setPlaceholderIncluded] = useState(false)
  const [placeholderOrder, setPlaceholderOrder] = useState<number | undefined>(
    undefined
  )

  useEffect(() => {
    if (isPlaceholder) return

    const handlePlaceholderChange: PlaceholderListener = (
      isIncludedNow,
      order
    ) => {
      setPlaceholderIncluded(isIncludedNow)
      setPlaceholderOrder(order)
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

      if (!placeholderIsIncluded) {
        return children.map((node) => node.data)
      }

      return splicePlaceholder(
        children,
        assert(
          model.getPlaceholderData(),
          "Could not get placeholder id, even though placeholder is included in these siblings"
        ),
        assert(
          placeholderOrder,
          "Do not have placeholder order, even though placeholder is included in these siblings"
        )
      )
    },
    [model, children, placeholderIsIncluded, placeholderOrder, isPlaceholder]
  )
}

/**
 * Returns a copy of the provided nodes array with an additional node spliced in
 * based on the provided order
 */
function splicePlaceholder<Datum>(
  siblings: OrderedTreeNode<Datum>[],
  placeholderDatum: Datum,
  placeholderOrder: number
) {
  let spliceIndex = 0
  while (
    spliceIndex < siblings.length &&
    siblings[spliceIndex].order < placeholderOrder
  ) {
    spliceIndex++
  }

  const data = siblings.map((node) => node.data)

  data.splice(spliceIndex, 0, placeholderDatum)

  return data
}
