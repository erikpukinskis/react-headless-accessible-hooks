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
import { describeElement } from "~/describeElement"
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
    <OrderedTreeContext.Provider value={model as OrderedTreeModel<unknown>}>
      {children}
    </OrderedTreeContext.Provider>
  )
}

export type UseOrderedTreeArgs<Datum> = DatumFunctions<Datum> & {
  data: Datum[]
  onNodeMove(id: string, newOrder: number, newParentId: string | null): void
  onClick?(datum: Datum): void
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
  isDropping: boolean
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
  onClick,
  onBulkNodeOrder,
}: UseOrderedTreeArgs<Datum>): UseOrderedTreeReturnType<Datum> {
  const bulkOrderRef = useRef(onBulkNodeOrder)
  bulkOrderRef.current = onBulkNodeOrder
  const [isDropping, setIsDropping] = useState(false)

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
        onNodeMove,
        onDroppingChange: setIsDropping,
        onClick,
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
    model.setMoveHandler(onNodeMove)
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
      new ResizeObserver(function updateTreeBox([entry]) {
        const rect = entry.target.getBoundingClientRect()

        if (!rect.width) {
          model.setTreeBox(undefined)
          return
        }

        model.setTreeBox({
          top: rect.top,
          left: rect.left,
          height: rect.height,
        })
      })
  )

  const callbackRef = useCallback(
    function callbackRef(element: HTMLElement | null) {
      if (observedNodeRef.current && observedNodeRef.current === element) {
        return
      }

      if (observedNodeRef.current && observedNodeRef.current !== element) {
        treeObserver.unobserve(observedNodeRef.current)
        observedNodeRef.current = null
      }

      if (!element) {
        /// I still don't love how often we are setting the tree box to undefined
        model.setTreeBox(undefined)
        return
      }

      if (window.getComputedStyle(element).position !== "relative") {
        throw new Error(
          `The element you spread {...getTreeProps()} onto (${describeElement(
            element
          )}) must be have CSS position "relative" not "${
            element.style.position || "static"
          }".`
        )
      }

      treeObserver.observe(element)
      observedNodeRef.current = element
    },
    [model, treeObserver]
  )

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
    isDropping,
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

  // Note that if the datum is a placeholder, then it doesn't have a
  // corresponding node. So this node is the node for the original datum, and
  // node.data will be a different object than the placeholder datum:
  const node = model.getNode(datum)
  const isBeingDragged = model.isBeingDragged(node.id)
  const isPlaceholder = model.isPlaceholder(datum)
  const childIsBeingDragged = model.childIsBeingDragged(node.id)

  const { children, expansion } = useParent(
    node.children,
    datum,
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

type ParentState = {
  placeholderOrder: number | null
  expansion: "expanded" | "collapsed" | "no children"
  isDropping: boolean
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
  if (isPlaceholder) {
    if (!parent) {
      throw new Error("Root parent cannot be placeholder")
    }
    if (!Object.prototype.hasOwnProperty.call(parent, "__isRhahPlaceholder")) {
      throw new Error(
        `Tried to use placeholder parent, but datum with id ${model.data.getId(
          parent
        )} wasn't tagged as a placeholder`
      )
    }
  }

  const [state, setState] = useState<ParentState>(() => {
    const expansion = parent === null ? "expanded" : model.getExpansion(parent)

    return {
      placeholderOrder: null,
      expansion,
      isDropping: false,
    }
  })

  useEffect(() => {
    if (parent === null) return

    setState((state) => ({
      ...state,
      expansion: model.getExpansion(parent),
    }))
  }, [model, parent])

  const parentId = parent ? model.data.getId(parent) : null

  useEffect(() => {
    if (isPlaceholder) return

    const handleNodeChange: NodeListener = (change) => {
      setState((oldState) => {
        return { ...oldState, ...change }
      })
    }

    model.addPlaceholderListener(parentId, handleNodeChange)

    return () => {
      model.removePlaceholderListener(parentId, handleNodeChange)
    }
  }, [model, parentId, isPlaceholder, parent])

  const originalChildren = useMemo(() => {
    const data = childNodes.map((node) => node.data)

    assertUniqueKeys(data, model)

    return data
  }, [childNodes, model])

  const children = useMemo(
    function buildChildNodes(): Datum[] {
      const { expansion, placeholderOrder, isDropping } = state

      if (isPlaceholder) {
        return []
      }

      if (model.isIdle()) {
        return originalChildren
      }

      if (expansion === "collapsed") {
        return []
      }

      const removeId = isDropping ? model.dragStart?.node.id : undefined

      if (placeholderOrder !== null) {
        const placeholderDatum = model.getPlaceholderDatum()

        if (!placeholderDatum) {
          throw new Error(
            "Could not get placeholder id, even though placeholder is included in these siblings"
          )
        }

        const siblings = removeId
          ? removeSibling([...originalChildren], removeId, model.data.getId)
          : [...originalChildren]

        const data = spliceSibling({
          siblings,
          addDatum: model.getPlaceholderDatum(),
          atOrder: placeholderOrder,
          getOrder: model.getOrder.bind(model),
        })

        assertUniqueKeys(data, model)

        return data
      }

      if (removeId !== undefined) {
        return removeSibling([...originalChildren], removeId, model.data.getId)
      }

      return originalChildren
    },
    [state, isPlaceholder, model, originalChildren]
  )

  return {
    children,
    expansion: state.expansion,
  }
}

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
    const allKeys = data.map(model.getKey.bind(model))

    throw new Error(
      `Key${duplicateKeys.length > 1 ? "s" : ""} ${duplicateKeys.join(
        ","
      )} appear${
        duplicateKeys.length > 1 ? "" : "s"
      } twice in siblings: ${JSON.stringify(allKeys, null, 8)}`
    )
  }
}

type SpliceSiblingArgs<Datum> = {
  siblings: Datum[]
  addDatum: Datum
  atOrder: number
  getOrder: (datum: Datum) => number
}

/**
 * Returns a copy of the provided nodes array with an additional node spliced in
 * based on the order provided
 */
function spliceSibling<Datum>({
  siblings,
  addDatum,
  atOrder,
  getOrder,
}: SpliceSiblingArgs<Datum>) {
  // Next we find the index where the addDatum should be spliced in. This will
  // be either a placeholder datum, or during the isDropping phase it could be
  // the dropped datum.
  let spliceIndex = 0
  while (
    spliceIndex < siblings.length &&
    getOrder(siblings[spliceIndex]) < atOrder
  ) {
    spliceIndex++
  }

  siblings.splice(spliceIndex, 0, addDatum)

  return siblings
}

function removeSibling<Datum>(
  siblings: Datum[],
  idToRemove: string,
  getId: (datum: Datum) => string
) {
  return siblings.filter((sibling) => getId(sibling) !== idToRemove)
}
