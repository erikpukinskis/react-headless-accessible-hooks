import { describe, it, expect } from "vitest"
import type { OrderedTreeNode } from "./buildTree"
import { getAncestorChain } from "./drag"

type NodeOverrides = {
  id: string
  children: OrderedTreeNode<false>[]
  parents: OrderedTreeNode<false>[]
}

function buildNode({
  id,
  children,
  parents,
}: NodeOverrides): OrderedTreeNode<false> {
  return {
    id,
    children,
    parents,
    data: false,
    isLastChild: true,
    order: 0.5,
    isCollapsed: false,
    index: 0,
    key: id,
    isPlaceholder: false,
  }
}

describe("getAncestorChain", () => {
  /**
   * If the parents array for "node" is ["mom", "grandma", "gamgam"] then
   * "gamgam" is at depth 0, "grandma" is depth 1, "mom" is depth 2, and "node"
   * is depth 3.
   *
   * If the targetDepth is 1 then `getAncestorChain` will return an array in the
   * opposite order starting at the target depth: ["grandma", "mom", "node"]
   */
  it("should not loop infinitely", () => {
    const gamgam = buildNode({
      id: "gamgam",
      children: [],
      parents: [],
    })

    const grandma = buildNode({
      id: "grandma",
      children: [],
      parents: [gamgam],
    })

    const mom = buildNode({
      id: "mom",
      children: [],
      parents: [grandma, gamgam],
    })

    const node = buildNode({
      id: "node",
      children: [],
      parents: [mom, grandma, gamgam],
    })

    mom.children = [node]
    grandma.children = [mom]
    gamgam.children = [grandma]

    const ancestorIds = getAncestorChain(node, 1).map(({ id }) => id)
    expect(ancestorIds).toEqual(["grandma", "mom", "node"])
  })
})
