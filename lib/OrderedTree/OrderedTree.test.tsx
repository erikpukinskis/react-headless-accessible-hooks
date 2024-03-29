import { render, fireEvent, cleanup } from "@testing-library/react"
import produce from "immer"
import React, { Profiler, useEffect, useState } from "react"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { useOrderedTree, useOrderedTreeNode } from "./useOrderedTree"
import type { DatumFunctions, UseOrderedTreeArgs } from "./useOrderedTree"
import type { Kin } from "~/kin"
import { buildKin } from "~/kin"
import { MockDOMLayout } from "~/testHelpers"

describe("OrderedTree", () => {
  const layout = new MockDOMLayout()

  afterEach(cleanup)

  afterEach(() => layout.cleanup())

  afterAll(() => layout.destroy())

  it("swaps two nodes", () => {
    const moveNode = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    const { rows, tree } = renderTree({
      data: [first, second],
      onNodeMove: moveNode,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
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

  it("doesn't fire onNodeMove if we drag nowhere", () => {
    const moveNode = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    const { rows, tree } = renderTree({
      data: [first, second],
      onNodeMove: moveNode,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
    })

    expect(tree).toHaveTextContent("- First;- Second;")

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
      clientX: 7,
      clientY: 30,
    })

    fireEvent.mouseMove(rows[1], {
      clientX: 6,
      clientY: 30,
    })

    expect(rows[1]).toHaveAttribute("class", "dragging")

    expect(tree).toHaveTextContent("- First;- Placeholder for Second;- Second;")

    fireEvent.mouseUp(rows[1], {
      clientX: 7,
      clientY: 30,
    })

    expect(moveNode).not.toHaveBeenCalled()

    expect(rows[0]).not.toHaveAttribute("class", "dragging")

    expect(tree).toHaveTextContent("- First;- Second;")
  })

  it("leaves placeholder in the tree until an update", () => {
    const onNodeMove = vi.fn()
    let opacity = "1"

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    function TreeWithDelayedSave() {
      const state = useState([first, second])

      const { roots, getTreeProps, getKey, TreeProvider, isDropping } =
        useOrderedTree({
          onNodeMove,
          onBulkNodeOrder: () => {},
          data: state[0],
          ...DATUM_FUNCTIONS,
        })

      useEffect(() => {
        opacity = isDropping ? "0.5" : "1"
      }, [isDropping])

      return (
        <div {...getTreeProps()} style={{ position: "relative" }}>
          <TreeProvider>
            {roots.map((node) => (
              <KinNode key={getKey(node)} data-key={getKey(node)} kin={node} />
            ))}
          </TreeProvider>
        </div>
      )
    }

    const result = render(<TreeWithDelayedSave />)

    const rows = result.queryAllByRole("treeitem")
    const tree = result.getByRole("tree")

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
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
      clientY: 20,
    })

    expect(tree).toHaveTextContent("- First;- Second;- Placeholder for First;")

    fireEvent.mouseUp(rows[0], {
      clientX: 10,
      clientY: 20,
    })

    expect(onNodeMove).toHaveBeenCalledWith("first", 0.8, null)

    expect(tree).toHaveTextContent("- Second;- Placeholder for First;")

    expect(opacity).toBe("0.5")
  })

  it("places a node as a child of another", () => {
    const moveNode = vi.fn()

    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })
    const third = buildKin({ id: "third", order: 0.8, parentId: null })

    const { rows, tree } = renderTree({
      data: [first, second, third],
      onNodeMove: moveNode,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    // Just a wiggle
    fireEvent.mouseMove(rows[1], {
      clientX: 10,
      clientY: 32,
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

    const { rows, tree } = renderTree({
      data: [parent, child, secondChild],
      onNodeMove: moveNode,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    const onMount = vi.fn()

    const { rows, tree } = renderTree({
      data: [parent, child, secondChild],
      onNodeMove: moveNode,
      onMount,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    // Wiggle mouse
    fireEvent.mouseMove(son, {
      clientX: 11,
      clientY: 30,
    })

    expect(tree).toHaveTextContent(
      "- Parent;- Placeholder for Son;- Son;- Daughter;"
    )

    // Drag son rightwards
    fireEvent.mouseMove(son, {
      clientX: 50,
      clientY: 30,
    })

    fireEvent.mouseUp(son, {
      clientX: 50,
      clientY: 30,
    })

    expect(tree).toHaveTextContent("v Parent;-- Son;- Daughter;")
    expect(daughter).toBeInTheDocument()

    fireEvent.mouseDown(daughter, {
      clientX: 10,
      clientY: 50,
    })

    // Wiggle mouse
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

    const {
      rows: [firstRow, secondRow],
      tree,
    } = renderTree({
      data: [first, second],
      onNodeMove: moveNode,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    const parent = buildKin({ id: "parent", order: 0.5, parentId: null })
    const child = buildKin({ id: "child", order: 0.5, parentId: "parent" })

    const onMount = vi.fn()

    const { rows, tree } = renderTree({
      data: [parent, child],
      onNodeMove: moveNode,
      onMount,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
    })

    layout.mockListBoundingRects(rows, {
      left: 0,
      top: 0,
      width: 200,
      height: 20,
    })

    expect(tree).toHaveTextContent("v Parent;-- Child;")

    fireEvent.mouseDown(rows[1], {
      clientX: 10,
      clientY: 30,
    })

    fireEvent.mouseMove(rows[1], {
      clientX: 10,
      clientY: 10,
    })

    expect(tree).toHaveTextContent("- Placeholder for Child;- Parent;-- Child;")

    fireEvent.mouseUp(rows[1], {
      clientX: 10,
      clientY: 10,
    })

    expect(moveNode).toHaveBeenCalledWith("child", 0.25, null)

    expect(tree).toHaveTextContent("- Child;- Parent;")
  })

  it("reparents a node by dragging it up and to the right", () => {
    const first = buildKin({ id: "first", order: 0.4, parentId: null })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })
    const third = buildKin({ id: "third", order: 0.8, parentId: null })

    const { rows, tree } = renderTree({
      data: [first, second, third],
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    const { rows, tree } = renderTree({
      data: [first, second],
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 40,
        left: 0,
        top: 0,
      },
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

    const { rows, tree } = renderTree({
      data: [first, second, parent],
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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

    const { rows, tree } = renderTree({
      data: [daughter, momma, kiddo],
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 60,
        left: 0,
        top: 0,
      },
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
    const child = buildKin({ id: "child", order: 0.4, parentId: "parent" })
    const grandchild = buildKin({
      id: "grandchild",
      order: 0.4,
      parentId: "child",
    })
    const second = buildKin({ id: "second", order: 0.6, parentId: null })

    const { rows, tree, result } = renderTree({
      data: [child, second, parent, grandchild],
    })

    expect(tree).toHaveTextContent("v Parent;-v Child;--- Grandchild;- Second;")

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

    // Nudge the mouse
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

    fireEvent.mouseUp(rows[0], {
      clientX: 10,
      clientY: 30,
    })

    expect(tree).toHaveTextContent("- Second;v Parent;-v Child;--- Grandchild;")
  })

  it("fires a row click event", () => {
    const onClick = vi.fn()

    const kin = buildKin({ id: "click-me", order: null })

    const { rows, tree } = renderTree({
      data: [kin],
      onClick,
    })

    layout.resize(tree, {
      contentRect: {
        width: 200,
        height: 20,
        left: 0,
        top: 0,
      },
    })

    expect(rows).toHaveLength(1)

    expect(tree).toHaveTextContent("- Click Me;")

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

    fireEvent.mouseUp(rows[0], {
      clientX: 10,
      clientY: 12,
    })

    expect(tree).toHaveTextContent("- Click Me;")
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "click-me" })
    )
  })
})

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
    <div {...getTreeProps()} style={{ position: "relative" }}>
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
    isBeingDragged,
    expansion,
    getKey,
  } = useOrderedTreeNode(kin)

  const prefix = `${[...(Array(depth) as unknown[])].map(() => "-").join("")}${
    expansion === "collapsed" ? ">" : expansion === "expanded" ? "v" : "-"
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
      <div
        {...getNodeProps()}
        className={isBeingDragged ? "dragging" : undefined}
      >
        {prefix} {kin.name};
      </div>
      {children.map((child) => (
        <KinNode key={getKey(child)} kin={child} />
      ))}
    </>
  )
}
