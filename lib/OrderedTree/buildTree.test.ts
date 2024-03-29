import { cloneDeep } from "lodash"
import { describe, it, expect } from "vitest"
import type { DatumFunctions } from "./buildTree"
import {
  prebuildTree,
  buildTreeIndexesWithNodeCollapsed,
  buildTree,
  placeWithinSiblings,
} from "./buildTree"
import { buildKin } from "~/kin"

type Kin = {
  id: string
  createdAt: string
  name: string
  parentId: null | string
  order: null | number
  isCollapsed: boolean
}

const GRAMPS = {
  id: "gramps",
  createdAt: "2022-01-01",
  name: "gramps",
  parentId: null,
  order: null,
  isCollapsed: false,
}

const AUNTIE = {
  id: "auntie",
  createdAt: "2022-01-02",
  name: "auntie",
  parentId: "gramps",
  order: null,
  isCollapsed: false,
}

const MOMMA = {
  id: "momma",
  createdAt: "2022-01-03",
  name: "momma",
  parentId: "gramps",
  order: null,
  isCollapsed: false,
}

const GRANDKID = {
  id: "grandkid",
  createdAt: "2022-01-04",
  name: "grandkid",
  parentId: "momma",
  order: null,
  isCollapsed: false,
}

const DATA: Kin[] = [GRAMPS, AUNTIE, MOMMA, GRANDKID]

const FUNCTIONS: DatumFunctions<Kin> = {
  getId: (kin) => kin.id,
  getParentId: (kin) => kin.parentId,
  getOrder: (kin) => kin.order,
  isCollapsed: (kin) => kin.isCollapsed,
  compare: (a, b) => {
    return new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
  },
}

describe("buildTree", () => {
  /**
   * For testing, this tree starts out like:
   *
   *     > gramps
   *     - - auntie
   *     - > momma
   *     - - - grandkid
   */
  const [gramps, auntie, momma, grandkid] = DATA

  it("should list parents", () => {
    const { roots } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(roots[0].data.name).toBe("gramps")
    const grampsBranch = roots[0]
    expect(grampsBranch.parents).toHaveLength(0)

    expect(roots[0].children[0].data.name).toBe("momma")
    const mommaBranch = roots[0].children[0]
    expect(mommaBranch.parents).toHaveLength(1)
    expect(mommaBranch.parents[0].data.name).toBe("gramps")

    expect(roots[0].children[0].children[0].data.name).toBe("grandkid")
    const grandkidBranch = roots[0].children[0].children[0]
    expect(grandkidBranch.parents).toHaveLength(2)
    expect(grandkidBranch.parents[0].data.name).toBe("momma")
    expect(grandkidBranch.parents[1].data.name).toBe("gramps")

    expect(roots[0].children[1].data.name).toBe("auntie")
    const auntieBranch = roots[0].children[1]
    expect(auntieBranch.parents).toHaveLength(1)
    expect(auntieBranch.parents[0].data.name).toBe("gramps")
  })

  it("should add indexes for needs within the full tree", () => {
    const { roots, indexesById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(roots[0].data.name).toBe("gramps")
    expect(indexesById["gramps"]).toBe(0)

    expect(roots[0].children[0].data.name).toBe("momma")
    expect(indexesById["momma"]).toBe(1)

    expect(roots[0].children[0].children[0].data.name).toBe("grandkid")
    expect(indexesById["grandkid"]).toBe(2)

    expect(roots[0].children[1].data.name).toBe("auntie")
    expect(indexesById["auntie"]).toBe(3)
  })

  it("should list need parents", () => {
    const { roots, indexesById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(roots[0].data.name).toBe("gramps")
    expect(indexesById["gramps"]).toBe(0)

    expect(roots[0].children[0].data.name).toBe("momma")
    expect(indexesById["momma"]).toBe(1)

    expect(roots[0].children[0].children[0].data.name).toBe("grandkid")
    expect(indexesById["grandkid"]).toBe(2)

    expect(roots[0].children[1].data.name).toBe("auntie")
    expect(indexesById["auntie"]).toBe(3)
  })

  it("should ignore collapsed needs when generating the indexes", () => {
    const collapsedMomma: Kin = { ...momma, isCollapsed: true }
    const data = cloneDeep([auntie, grandkid, collapsedMomma, gramps])
    const { roots, indexesById } = buildTree({
      data,
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(roots[0].data.name).toBe("gramps")
    expect(roots[0].children).toHaveLength(2)
    expect(indexesById["gramps"]).toBe(0)

    expect(roots[0].children[0].data.name).toBe("momma")
    expect(indexesById["momma"]).toBe(1)
    expect(roots[0].children[0].children).toHaveLength(0) // no subneeds if collapsed!

    expect(roots[0].children[1].data.name).toBe("auntie")
    expect(indexesById["auntie"]).toBe(2)
  })

  it("should provide updates for all needs", () => {
    const { missingOrdersById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    const updates = Object.entries(missingOrdersById).reduce(
      (updates, [id, order]) => ({
        ...updates,
        [id]: order,
      }),
      {} as Record<string, number>
    )

    expect(updates[gramps.id]).toBeCloseTo(0.5)
    expect(updates[momma.id]).toBeCloseTo(0.3333)
    expect(updates[auntie.id]).toBeCloseTo(0.6666)
    expect(updates[grandkid.id]).toBeCloseTo(0.5)
  })

  it("should set a smaller order when we move an item before another", () => {
    const { roots, missingOrdersById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: gramps.id,
        siblings: roots,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.25)

    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: momma.id,
        siblings: roots[0].children,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.16666)
  })

  it("should set a larger order when we move an item after another", () => {
    const { roots, missingOrdersById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: gramps.id,
        siblings: roots,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.75)
    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: auntie.id,
        siblings: roots[0].children,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.8333)
  })

  it("should set an order between two items", () => {
    const { roots, missingOrdersById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: momma.id,
        siblings: roots[0].children,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.5)
    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: auntie.id,
        siblings: roots[0].children,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.5)
  })

  it("inserts a new first child before an existing child", () => {
    const { roots, missingOrdersById } = buildTree({
      data: cloneDeep(DATA),
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    const gramps = roots[0]

    expect(
      placeWithinSiblings({
        direction: "first-child",
        siblings: gramps.children,
        missingOrdersById,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.1666)
  })

  it("returns nodes as orphans if their parent is not present", () => {
    const tree = buildTree({
      data: [
        buildKin({ id: "auntie", parentId: "gramps" }),
        buildKin({ id: "momma", parentId: "gramps" }),
        buildKin({ id: "grandkid", parentId: "momma" }),
      ],
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    expect(tree.roots).toHaveLength(0)
    expect(tree.orphanData).toHaveLength(2)
    expect(tree.orphanData[0].id).toBe("auntie")
    expect(tree.orphanData[1].id).toBe("momma")
  })

  it("filters out node trees", () => {
    const tree = buildTree({
      data: [
        buildKin({ id: "auntie" }),
        buildKin({ id: "momma" }),
        buildKin({ id: "grandkid", parentId: "momma" }),
      ],
      ...FUNCTIONS,
      isFilteredOut: (kin) => kin.id === "momma" || kin.id === "grandkid",
      expansionOverrideMask: {},
    })

    expect(tree.roots).toHaveLength(1)
    expect(tree.roots[0].id).toBe("auntie")
  })

  it("includes children of nodes that match filters", () => {
    const tree = buildTree({
      data: [
        buildKin({ id: "auntie" }),
        buildKin({ id: "momma" }),
        buildKin({ id: "grandkid", parentId: "momma" }),
      ],
      ...FUNCTIONS,
      isFilteredOut: (kin) => kin.id === "auntie",
      expansionOverrideMask: {},
    })

    expect(tree.roots).toHaveLength(1)
    expect(tree.roots[0].id).toBe("momma")
    expect(tree.roots[0].children).toHaveLength(1)
    expect(tree.roots[0].children[0].id).toBe("grandkid")
  })

  it("filter index includes nodes whose children match filters", () => {
    const { hasChildrenFilteredIn } = prebuildTree({
      data: [
        buildKin({ id: "produce" }),
        buildKin({ id: "cereals" }),
        buildKin({ id: "banana-pops", parentId: "cereals" }),
      ],
      getParentId: FUNCTIONS["getParentId"],
      getId: FUNCTIONS["getId"],
      isFilteredOut: (kin) => kin.id !== "banana-pops",
      isCollapsed: (kin) => kin.isCollapsed,
    })

    expect(hasChildrenFilteredIn["banana-pops"]).toBeTruthy()
    expect(hasChildrenFilteredIn["cereals"]).toBeTruthy()
    expect(hasChildrenFilteredIn["produce"]).toBeFalsy()
  })

  it("expands parents of children that match", () => {
    const tree = buildTree({
      data: [
        buildKin({ id: "auntie" }),
        buildKin({ id: "momma", isCollapsed: true }),
        buildKin({ id: "grandkid", parentId: "momma" }),
      ],
      ...FUNCTIONS,
      isFilteredOut: (kin) => kin.id === "auntie",
      expansionOverrideMask: {},
    })

    expect(tree.roots).toHaveLength(1)
    expect(tree.roots[0].id).toBe("momma")
    expect(tree.roots[0].children).toHaveLength(1)
    expect(tree.roots[0].children[0].id).toBe("grandkid")
  })

  it("rebuilds indexes with a node collapsed", () => {
    const parent: Kin = {
      id: "parent",
      createdAt: "2022-01-02",
      name: "Parent",
      parentId: null,
      order: 0.5,
      isCollapsed: false,
    }

    const child: Kin = {
      id: "child",
      createdAt: "2022-01-02",
      name: "Child",
      parentId: "parent",
      order: 0.4,
      isCollapsed: false,
    }

    const peer: Kin = {
      id: "peer",
      createdAt: "2022-01-02",
      name: "Peer",
      parentId: null,
      order: 0.6,
      isCollapsed: false,
    }

    const tree = buildTree({
      data: [parent, child, peer],
      ...FUNCTIONS,
      expansionOverrideMask: {},
    })

    const nodeToCollapse = tree.nodesById["parent"]

    const indexes = buildTreeIndexesWithNodeCollapsed(tree, nodeToCollapse)

    expect(indexes.indexesById).toMatchObject({
      parent: 0,
      peer: 1,
    })
  })
})
