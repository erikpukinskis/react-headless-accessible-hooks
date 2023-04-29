import { render, fireEvent, cleanup } from "@testing-library/react"
import produce from "immer"
import { startCase } from "lodash"
import React, { Profiler, useState } from "react"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { useOrderedTree, useOrderedTreeNode } from "./useOrderedTree"
import type { DatumFunctions, UseOrderedTreeArgs } from "./useOrderedTree"
import { MockDOMLayout } from "~/testHelpers"

describe("OrderedTree", () => {
  const layout = new MockDOMLayout()

  afterEach(cleanup)

  afterEach(layout.cleanup)

  afterAll(layout.destroy)

  it("swaps two nodes", () => {
    const moveNode = vi.fn()

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
      onNodeMove: moveNode,
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

    expect(rows[0]).toBeInTheDocument()

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

    expect(moveNode).toHaveBeenCalledWith("first", 0.8, null)

    expect(tree).toHaveTextContent("- Second;- First;")
  })

  it("places a node as a child of another", () => {
    const moveNode = vi.fn()

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
      onNodeMove: moveNode,
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

    expect(moveNode).toHaveBeenCalledWith("second", 0.5, "first")

    expect(tree).toHaveTextContent("v First;-- Second;- Third;")
  })

  it("drags a sibling before a child", () => {
    const moveNode = vi.fn()

    const parent = buildKin({ id: "parent", order: 0.2, parentId: null })
    const child = buildKin({ id: "child", order: 0.5, parentId: "parent" })
    const secondChild = buildKin({
      id: "second-child",
      order: 0.6,
      parentId: null,
    })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [parent, child, secondChild],
      onNodeMove: moveNode,
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
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- Placeholder for Second Child;-- Child;- Second Child;"
    )

    fireEvent.mouseUp(rows[2], {
      clientX: 10,
      clientY: 30,
    })

    expect(moveNode).toHaveBeenCalledWith("second-child", 0.25, "parent")

    expect(tree).toHaveTextContent("v Parent;-- Second Child;-- Child;")
  })

  it("drags right to place a node as grandchild", () => {
    const moveNode = vi.fn()

    const parent = buildKin({ id: "parent", order: 0.2, parentId: null })
    const child = buildKin({ id: "child", order: 0.5, parentId: "parent" })
    const secondChild = buildKin({
      id: "third",
      order: 0.6,
      parentId: null,
    })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const onMount = vi.fn()

    const { rows, tree } = renderTree({
      data: [parent, child, secondChild],
      onNodeMove: moveNode,
      onMount,
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
      clientX: 11,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- Child;- Placeholder for Third;- Third;"
    )

    fireEvent.mouseMove(rows[2], {
      clientX: 51,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- Child;-- Placeholder for Third;- Third;"
    )

    fireEvent.mouseMove(rows[2], {
      clientX: 91,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-v Child;--- Placeholder for Third;- Third;"
    )

    expect(onMount).toHaveBeenCalledOnce()
  })

  it("drags two nodes right", () => {
    const moveNode = vi.fn()

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [
        buildKin({ id: "parent", order: 0.2, parentId: null }),
        buildKin({ id: "son", order: 0.4, parentId: null }),
        buildKin({
          id: "daughter",
          order: 0.6,
          parentId: null,
        }),
      ],
      onNodeMove: moveNode,
    })

    const [_, son, daughter] = rows

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(son, {
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent("- Parent;- Son;- Daughter;")

    fireEvent.mouseMove(son, {
      clientX: 11,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "- Parent;- Placeholder for Son;- Son;- Daughter;"
    )

    fireEvent.mouseMove(son, {
      clientX: 50,
      clientY: 30,
    })

    fireEvent.mouseUp(son, {
      clientX: 50,
      clientY: 30,
    })

    expect(tree).toHaveTextContent("v Parent;-- Son;- Daughter;")

    fireEvent.mouseDown(daughter, {
      clientX: 10,
      clientY: 50,
    })

    fireEvent.mouseMove(daughter, {
      clientX: 11,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- Son;- Placeholder for Daughter;- Daughter;"
    )

    fireEvent.mouseMove(daughter, {
      clientX: 50,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- Son;-- Placeholder for Daughter;- Daughter;"
    )

    fireEvent.mouseUp(daughter, {
      clientX: 50,
      clientY: 50,
    })

    expect(tree).toHaveTextContent("v Parent;-- Son;-- Daughter;")
  })

  it("can still drag a node right after you swapped one above it", () => {
    const moveNode = vi.fn()

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
    } = renderTree({
      data: [first, second],
      onNodeMove: moveNode,
    })

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
    const moveNode = vi.fn()

    const first = buildKin({ id: "first", order: 0.5, parentId: null })
    const second = buildKin({ id: "second", order: 0.5, parentId: "first" })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 40,
      left: 0,
      top: 0,
    })

    const onMount = vi.fn()

    const { rows, tree } = renderTree({
      data: [first, second],
      onNodeMove: moveNode,
      onMount,
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

    expect(moveNode).toHaveBeenCalledWith("second", 0.25, null)

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

  it("can unparent an second child by dragging left", () => {
    const parent = buildKin({ id: "parent", order: 0.5, parentId: null })
    const first = buildKin({ id: "first", order: 0.4, parentId: "parent" })
    const second = buildKin({ id: "second", order: 0.6, parentId: "parent" })

    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree } = renderTree({
      data: [first, second, parent],
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseDown(rows[2], {
      clientX: 50,
      clientY: 50,
    })

    fireEvent.mouseMove(rows[2], {
      clientX: 10,
      clientY: 50,
    })

    expect(tree).toHaveTextContent(
      "v Parent;-- First;-- Second;- Placeholder for Second;"
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

  it("collapses nodes while dragging them", () => {
    const parent = buildKin({ id: "parent", order: 0.5, parentId: null })
    const first = buildKin({ id: "first", order: 0.4, parentId: "parent" })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    /// Todo: this probably should be unnecessary since we're firing a resize
    /// below. Maybe instead of "mock" we can just describe all these APIs in
    /// terms of "resize"? Maybe "presize"? "layout.presizeByRole"?
    layout.mockRoleBoundingRects("tree", {
      width: 200,
      height: 60,
      left: 0,
      top: 0,
    })

    const { rows, tree, result } = renderTree({
      data: [first, second, parent],
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
    })

    fireEvent.mouseDown(rows[0], {
      clientX: 10,
      clientY: 10,
    })

    fireEvent.mouseMove(rows[0], {
      clientX: 10,
      clientY: 11,
    })

    expect(tree).toHaveTextContent(
      "> Placeholder for Parent;> Parent;- Second;"
    )

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
    })

    const rowsDuringDrag = result.getAllByRole("treeitem")

    layout.mockListBoundingRects(rowsDuringDrag, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    fireEvent.mouseMove(rows[0], {
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "> Parent;- Second;> Placeholder for Parent;"
    )

    return

    fireEvent.mouseUp(rows[0], {
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent("- Second;v Parent;-- First;")
  })
})

/**
 * Minimal data type that can be rendered in the tree. This does not need to
 * follow any specific structure, in fact you could use a number or a string as
 * the data type. The useOrderedTree hook gets all of the information it needs
 * about your data via the "Datum Functions" defined below...
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

type RenderTreeArgs = KinTreeProps & {
  onMount?(): void
}
/**
 * Render the test Tree component and return some of the elements
 */
function renderTree({ onMount, ...props }: RenderTreeArgs) {
  const result = render(
    <Profiler
      id="KinTree"
      onRender={(_, phase) => {
        if (phase === "mount") onMount?.()
      }}
    >
      <KinTree {...props} />
    </Profiler>
  )

  const rows = result.queryAllByRole("treeitem")
  const tree = result.getByRole("tree")

  return { rows, tree, dump: () => console.log(result.debug()), result }
}

/**
 * Functions to get necessary information about items in the `data` array you
 * pass to `useOrderedTree`
 */
const DATUM_FUNCTIONS: DatumFunctions<Kin> = {
  /* Unique id to be used to index your data */
  getId: (kin) => kin.id,
  /* Parent id of a given datum, or `null` if it is a root node */
  getParentId: (kin) => kin.parentId,
  /* Number representing the order of a datum within its siblings */
  getOrder: (kin) => kin.order,
  /* If no manual order has been set, backup function to sort unsorted data */
  compare: (a: Kin, b: Kin) => {
    return new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
  },
  /* Return true if the node should be collapsed (hiding its children) */
  isCollapsed: (kin) => kin.isCollapsed,
}

type KinTreeProps = Partial<UseOrderedTreeArgs<Kin>> & {
  data: Kin[]
}

/**
 * Example component which renders an orderable tree of family members.
 *
 * This component sets up the `useOrderedTree` hook, its callbacks, and then
 * renders out the root nodes (where the parent id is `null`).
 */
function KinTree({
  data: initialData,
  onNodeMove: moveNode,
  ...overrides
}: KinTreeProps) {
  const [data, setData] = useState(initialData)

  function moveNodeAndSave(
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
    moveNode?.(id, newOrder, newParentId)
  }

  function updateBulkOrder(ordersById: Record<string, number>) {
    const reorderedData = data.map((kin) => {
      const newOrder = ordersById[kin.id]

      if (newOrder === undefined) return kin

      return { ...kin, order: newOrder }
    })

    setData(reorderedData)
  }

  const { roots, getTreeProps, getKey, TreeProvider } = useOrderedTree({
    onNodeMove: moveNodeAndSave,
    onBulkNodeOrder: updateBulkOrder,
    data,
    ...DATUM_FUNCTIONS,
    ...overrides,
  })

  return (
    <div {...getTreeProps()}>
      <TreeProvider>
        {roots.map((node) => (
          <KinNode key={getKey(node)} data-key={getKey(node)} kin={node} />
        ))}
      </TreeProvider>
    </div>
  )
}

type KinNodeProps = {
  kin: Kin
}

/**
 * Renders a single tree node with its children, with a simple depth indicator
 * made of dashes and angle brackets.
 *
 * The contents of each row will be a single cell like
 *
 *     - Gramps
 *     -> Auntie
 *     -> Momma
 *     ->> Grandkid
 *
 * but in a real-world example these divs would likely be styled with disclosure
 * icons, etc.
 *
 * This component also demonstrates how to use the `useOrderedTreeNode` hook,
 * which is the way to get the tree state relating to a specific node.
 */
function KinNode({ kin }: KinNodeProps) {
  const {
    children,
    getNodeProps,
    depth,
    isPlaceholder,
    isExpanded,
    isCollapsed,
    getKey,
  } = useOrderedTreeNode(kin)

  const prefix = `${[...(Array(depth) as unknown[])].map(() => "-").join("")}${
    isCollapsed ? ">" : isExpanded ? "v" : "-"
  }`

  if (isPlaceholder) {
    return (
      <div data-key={getKey(kin)} role="treeitem">
        {prefix} Placeholder for {kin.name};
      </div>
    )
  }

  return (
    <>
      <div {...getNodeProps()}>
        {prefix} {kin.name};
      </div>
      {children.map((child) => (
        <KinNode key={getKey(child)} kin={child} />
      ))}
    </>
  )
}
