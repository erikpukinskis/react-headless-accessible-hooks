import { map } from "lodash"
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
import { makeUninitializedContext } from "~/helpers"

export type { OrderedTreeNode, DatumFunctions } from "./buildTree"

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

export function OrderedTreeProvider<Datum>({
  children,
  model,
}: OrderedTreeProviderProps<Datum>) {
  if (!model) {
    throw new Error(
      `OrderedTreeProvider must get a model from useOrderedTree. Try:

        const { model } = useOrderedTree(...)

        <OrderedTreeProvider model={model}>
          ...
        </OrderedTreeProvider>
`
    )
  }

  return (
    <OrderedTreeContext.Provider value={model}>
      {children}
    </OrderedTreeContext.Provider>
  )
}

export type UseOrderedTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  onOrderChange(id: string, newOrder: number, newParentId: string | null): void
  dump?: DebugDataDumper
}

type GetTreeProps = () => React.HTMLAttributes<HTMLElement> & {
  ref(node: HTMLElement | null): void
}

export type GetNodeProps = () => React.HTMLAttributes<HTMLElement>

type UseOrderedTreeReturnType<Datum> = {
  roots: OrderedTreeNode<Datum>[]
  getTreeProps: GetTreeProps
  model: OrderedTreeModel<Datum>
}

export function useOrderedTree<Datum>({
  data,

  // Datum functions
  getParentId,
  getId,
  compare,
  getOrder,
  setOrder,
  isCollapsed,

  // Callbacks
  dump,
  onOrderChange,
}: UseOrderedTreeArgs<Datum>): UseOrderedTreeReturnType<Datum> {
  const datumFunctions = useMemo(
    () => ({
      getParentId,
      getId,
      compare,
      getOrder,
      setOrder,
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
        nodesByIndex: tree.nodesByIndex,
        treeSize: tree.treeSize,
        roots: tree.roots,
        getParentId,
        getOrder,
        getId,
        dump,
        onOrderChange,
      })
  )

  const rootsWithDragNode = useChildNodes(tree.roots, null, model, false)

  useEffect(() => {
    const newTree = buildTree({
      data,
      ...datumFunctions,
    })

    setTree(newTree)
    model.setData(newTree.nodesByIndex, newTree.treeSize, newTree.roots)
  }, [data, model, datumFunctions])

  useEffect(() => {
    model.nodesByIndex = tree.nodesByIndex
  }, [model, tree.nodesByIndex])

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

  return {
    roots: rootsWithDragNode,
    getTreeProps,
    model,
  }
}

export function useOrderedTreeNode<Datum>(node: OrderedTreeNode<Datum>) {
  const model = useModel<Datum>()

  const childNodes = useChildNodes(
    node.children,
    node.id,
    model,
    node.isPlaceholder
  )

  const getParentProps = useCallback<GetNodeProps>(() => {
    const key = node.isPlaceholder ? `${node.id}-placeholder` : node.id

    return {
      onMouseDown: model.handleMouseDown.bind(model, node),
      key,
      role: "treeitem",
    }
  }, [node, model])

  const depth = node.isPlaceholder
    ? model.getPlaceholderDepth()
    : node.parents.length

  const isBeingDragged = model.isBeingDragged(node)

  const childIsBeingDragged = model.childIsBeingDragged(node)

  return {
    childNodes,
    getParentProps,
    depth,
    isBeingDragged,
    childIsBeingDragged,
  }
}

function useChildNodes<Datum>(
  nodes: OrderedTreeNode<Datum>[],
  parentId: string | null,
  model: OrderedTreeModel<Datum>,
  isPlaceholder: boolean
) {
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

  const childNodes = useMemo(
    function buildChildNodes() {
      if (isPlaceholder) return []

      if (!model.dragStart) {
        assertUniqueKeys(nodes)
        return nodes
      }

      const nodesWithPlaceholder = placeholderIsIncluded
        ? model.getNodesWithPlaceholder(nodes)
        : nodes

      /// Wait, shouldn't we be passing a fresh placeholderOrder here? Is this not causing a problem?
      const nodesWithDraggedNodeMarked = nodesWithPlaceholder.map((node) => {
        if (model.isBeingDragged(node)) {
          return {
            ...node,
            isBeingDragged: true,
          }
        } else {
          return node
        }
      })

      assertUniqueKeys(nodesWithDraggedNodeMarked)

      return nodesWithDraggedNodeMarked
    },
    [model, nodes, placeholderIsIncluded, placeholderOrder, isPlaceholder]
  )

  return childNodes
}

function assertUniqueKeys(nodes: OrderedTreeNode<unknown>[]) {
  const sorted = map(nodes, "key").sort()

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] === sorted[i]) {
      throw new Error(`Duplicate key: ${sorted[i]}`)
    }
  }
}
