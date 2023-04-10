import { render, fireEvent, cleanup } from "@testing-library/react"
import produce from "immer"
import { startCase } from "lodash"
import React, { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  OrderedTreeProvider,
  useOrderedTree,
  useOrderedTreeNode,
} from "./useOrderedTree"
import type {
  DatumFunctions,
  UseOrderedTreeArgs,
  OrderedTreeNode,
} from "./useOrderedTree"
import { MockDOMLayout } from "~/testHelpers"

describe("OrderedTree", () => {
  const layout = new MockDOMLayout()

  afterEach(cleanup)

  afterEach(layout.cleanup)

  it("swaps two nodes", () => {
    const onOrderChange = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 40,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second],
      onOrderChange,
    })

    expect(rows).toHaveLength(2)

    expect(tree).toHaveTextContent("- First;- Second;")

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[0], {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseMove(rows[0], {
      clientX: 10,
      clientY: 12,
    })

    expect(tree).toHaveTextContent("- Placeholder for First;- First;- Second;")

    expect(rows[0]).toHaveComputedStyle({
      left: "0.0px",
      top: "2.0px",
    })

    fireEvent.mouseMove(rows[0], {
      clientX: 10,
      clientY: 20,
    })

    expect(tree).toHaveTextContent("- First;- Second;- Placeholder for First;")

    fireEvent.mouseUp(rows[0], {
      clientX: 10,
      clientY: 20,
    })

    expect(onOrderChange).toHaveBeenCalledWith("first", 0.8, null)

    expect(tree).toHaveTextContent("- Second;- First;")
  })

  it("places a node as a child of another", () => {
    const onOrderChange = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })
    const third = buildKin({ id: "third", order: 0.8, parentId: null })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second, third],
      onOrderChange,
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[1], {
      clientX: 10,
      clientY: 30,
    })

    fireEvent.mouseMove(rows[1], {
      clientX: 10,
      clientY: 32,
    })

    // The height of the tree can vary a bit, depending on whether the node
    // being dragged has popped out and the placeholder node has popped in, so
    // we'll change the height here to stress test that:
    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 40,
      left: 0,
      top: 0,
    })

    expect(tree).toHaveTextContent(
      "- First;- Placeholder for Second;- Second;- Third;"
    )

    fireEvent.mouseMove(rows[1], {
      clientX: 51, // We need to drag 40px to the right to trigger a re-parenting
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "v First;-- Placeholder for Second;- Second;- Third;"
    )

    fireEvent.mouseUp(rows[0], {
      clientX: 51,
      clientY: 30,
    })

    expect(onOrderChange).toHaveBeenCalledWith("second", 0.5, "first")

    expect(tree).toHaveTextContent("v First;-- Second;- Third;")
  })

  it("can still drag a node right after you swapped one above it", () => {
    const onOrderChange = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const {
      rows: [firstRow, secondRow],
      tree,
      dump,
    } = renderTree({
      data: [first, second],
      onOrderChange,
    })

    dump()

    layout.mockListBoundingRects([firstRow, secondRow], {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    expect(tree).toHaveTextContent("- First;- Second;")

    // First drag the second node up above the first

    fireEvent.mouseDown(secondRow, {
      clientX: 10,
      clientY: 30,
    })

    fireEvent.mouseMove(secondRow, {
      clientX: 10,
      clientY: 15,
    })

    expect(tree).toHaveTextContent("- Placeholder for Second;- First;- Second;")

    fireEvent.mouseUp(secondRow, {
      clientX: 10,
      clientY: 15,
    })

    expect(tree).toHaveTextContent("- Second;- First;")

    layout.mockListBoundingRects([secondRow, firstRow], {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    // Now to drag the (former) first node over

    fireEvent.mouseDown(firstRow, {
      clientX: 10,
      clientY: 30,
    })

    fireEvent.mouseMove(firstRow, {
      clientX: 10,
      clientY: 31,
    })

    expect(tree).toHaveTextContent("- Second;- Placeholder for First;- First;")

    // And then drag to the right:

    fireEvent.mouseMove(firstRow, {
      clientX: 51,
      clientY: 31,
    })

    expect(tree).toHaveTextContent("v Second;-- Placeholder for First;- First;")
  })

  it("places a child before its parent", () => {
    const onOrderChange = vi.fn()

    const first = buildKin({ id: "first", order: 0.5, parentId: null })
    const second = buildKin({ id: "second", order: 0.5, parentId: "first" })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 40,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second],
      onOrderChange,
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    expect(tree).toHaveTextContent("v First;-- Second;")

    fireEvent.mouseDown(rows[1], {
      clientX: 10,
      clientY: 30,
    })

    fireEvent.mouseMove(rows[1], {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseUp(rows[1], {
      clientX: 10,
      clientY: 10,
    })

    expect(onOrderChange).toHaveBeenCalledWith("second", 0.25, null)

    expect(tree).toHaveTextContent("- Second;- First;")
  })

  it("reparents a node by dragging it up and to the right", () => {
    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })
    const third = buildKin({ id: "third", order: 0.8, parentId: null })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second, third],
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[2], {
      clientX: 10,
      clientY: 50,
    })

    fireEvent.mouseMove(rows[2], {
      clientX: 50,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "v First;-- Placeholder for Third;- Second;- Third;"
    )
  })

  it("can unparent an only child by dragging left", () => {
    const first = buildKin({ id: "first", order: 0.5, parentId: null })
    const second = buildKin({ id: "second", order: 0.5, parentId: "first" })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 40,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second],
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[1], {
      clientX: 50,
      clientY: 30,
    })

    fireEvent.mouseMove(rows[1], {
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "- First;-- Second;- Placeholder for Second;"
    )
  })

  it("drags a node before the first child under a parent", () => {
    const daughter = buildKin({ id: "daughter", order: 0.2, parentId: null })
    const momma = buildKin({ id: "momma", order: 0.6, parentId: null })
    const kiddo = buildKin({ id: "kiddo", order: 0.5, parentId: "momma" })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [daughter, momma, kiddo],
    })

    expect(tree).toHaveTextContent("- Daughter;v Momma;-- Kiddo;")

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[0], {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseMove(rows[0], {
      clientX: 10,
      clientY: 20,
    })

    expect(tree).toHaveTextContent(
      "- Daughter;v Momma;-- Placeholder for Daughter;-- Kiddo;"
    )
  })
})

/**
 * Minimal data type that can be rendered in the tree
 */
type Kin = {
  id: string
  createdAt: string
  name: string
  parentId: null | string
  order: null | number
  isCollapsed: boolean
}

type KinOverrides = Partial<Kin> & Pick<Kin, "id">

/**
 * Factory for creating Kin objects
 */
function buildKin({ id, name, ...overrides }: KinOverrides) {
  return {
    id,
    createdAt: "2022-01-02",
    name: name ? name : startCase(id),
    parentId: null,
    order: null,
    isCollapsed: false,
    ...overrides,
  }
}

/**
 * Functions needed by `useOrderedTree` to treat this data type as tree nodes
 */
const DATUM_FUNCTIONS: DatumFunctions<Kin> = {
  getId: (kin) => kin.id,
  compare(a, b) {
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  },
  getParentId: (kin) => kin.parentId,
  getOrder: (kin) => kin.order,
  setOrder: (kin, order) => (kin.order = order),
  isCollapsed: (kin) => kin.isCollapsed,
}

/**
 * Render the test Tree component and return some of the elements
 */
function renderTree(props: TreeProps) {
  const result = render(<Tree {...props} />)

  const rows = result.queryAllByRole("treeitem")
  const tree = result.getByRole("tree")

  return { rows, tree, dump: () => console.log(result.debug()) }
}

type TreeProps = Partial<UseOrderedTreeArgs<Kin>> & {
  data: Kin[]
}

/**
 * Test tree component
 */
function Tree({ data: initialData, onOrderChange, ...overrides }: TreeProps) {
  const [data, setData] = useState(initialData)

  function handleOrderChange(
    id: string,
    newOrder: number,
    newParentId: string | null
  ) {
    setData((data) =>
      produce(data, (draft) => {
        const kin = draft.find((kin) => kin.id === id)
        if (!kin) {
          throw new Error(`No kin with id ${id}`)
        }
        kin.order = newOrder
        kin.parentId = newParentId
      })
    )
    onOrderChange?.(id, newOrder, newParentId)
  }

  const { roots, getTreeProps, model } = useOrderedTree({
    onOrderChange: handleOrderChange,
    data,
    ...DATUM_FUNCTIONS,
    ...overrides,
  })

  return (
    <OrderedTreeProvider model={model}>
      <div {...getTreeProps()}>
        {roots.map((node) => (
          <TreeNode key={log(node.key, "root")} node={node} />
        ))}
      </div>
    </OrderedTreeProvider>
  )
}

type TreeNodesProps = {
  node: OrderedTreeNode<Kin>
}

/**
 * Renders simple ordered table rows, with a simple depth indicator made of
 * dashes and angle brackets. The contents of each row will be a single cell
 * like:
 *
 *     - Gramps
 *     -> Auntie
 *     -> Momma
 *     ->> Grandkid
 */
function TreeNode({ node }: TreeNodesProps) {
  const { childNodes, getParentProps, depth, childIsBeingDragged } =
    useOrderedTreeNode(node)

  const isExpanded =
    childNodes.length > 1 || (childNodes.length === 1 && !childIsBeingDragged)

  const prefix = `${[...(Array(depth) as unknown[])].map(() => "-").join("")}${
    node.isCollapsed ? ">" : isExpanded ? "v" : "-"
  }`

  if (node.isPlaceholder) {
    return (
      <div>
        {prefix} Placeholder for {node.data.name};
      </div>
    )
  }

  return (
    <>
      <div {...getParentProps()}>
        {prefix} {node.data.name};
      </div>
      {childNodes.map((child) => (
        <TreeNode key={log(child.key, "child")} node={child} />
      ))}
    </>
  )
}

function log<T>(thing: T, label: string) {
  console.log(label, String(thing))
  return thing
}
