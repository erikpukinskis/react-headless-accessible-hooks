import { cloneDeep } from "lodash"
import { describe, it, expect } from "vitest"
import { buildTree, DatumFunctions, placeWithinSiblings } from "./buildTree"

type Kin = {
  id: string
  createdAt: string
  text: string
  parentId: null | string
  order: null | number
  isCollapsed: boolean
}

const DATA: Kin[] = [
  {
    id: "gramps",
    createdAt: "2022-01-01",
    text: "gramps",
    parentId: null,
    order: null,
    isCollapsed: false,
  },
  {
    id: "auntie",
    createdAt: "2022-01-02",
    text: "auntie",
    parentId: "gramps",
    order: null,
    isCollapsed: false,
  },
  {
    id: "momma",
    createdAt: "2022-01-03",
    text: "momma",
    parentId: "gramps",
    order: null,
    isCollapsed: false,
  },
  {
    id: "grandkid",
    createdAt: "2022-01-04",
    text: "grandkid",
    parentId: "momma",
    order: null,
    isCollapsed: false,
  },
]

const FUNCTIONS: DatumFunctions<Kin> = {
  getId: (kin) => kin.id,
  compare(a, b) {
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  },
  getParentId: (kin) => kin.parentId,
  getOrder: (kin) => kin.order,
  setOrder: (kin, order) => (kin.order = order),
  isCollapsed: (kin) => kin.isCollapsed,
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

  it("should list parents", async () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(roots[0].data.text).toBe("gramps")
    const grampsBranch = roots[0]
    expect(grampsBranch.parents).toHaveLength(0)

    expect(roots[0].children[0].data.text).toBe("momma")
    const mommaBranch = roots[0].children[0]
    expect(mommaBranch.parents).toHaveLength(1)
    expect(mommaBranch.parents[0].data.text).toBe("gramps")

    expect(roots[0].children[0].children[0].data.text).toBe("grandkid")
    const grandkidBranch = roots[0].children[0].children[0]
    expect(grandkidBranch.parents).toHaveLength(2)
    expect(grandkidBranch.parents[0].data.text).toBe("momma")
    expect(grandkidBranch.parents[1].data.text).toBe("gramps")

    expect(roots[0].children[1].data.text).toBe("auntie")
    const auntieBranch = roots[0].children[1]
    expect(auntieBranch.parents).toHaveLength(1)
    expect(auntieBranch.parents[0].data.text).toBe("gramps")
  })

  it("should mark last siblings", async () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(roots[0].data.text).toBe("gramps")
    expect(roots[0].isLastChild).toBe(true)

    expect(roots[0].children[0].data.text).toBe("momma")
    expect(roots[0].children[0].isLastChild).toBe(false)

    expect(roots[0].children[0].children[0].data.text).toBe("grandkid")
    expect(roots[0].children[0].children[0].isLastChild).toBe(true)

    expect(roots[0].children[1].data.text).toBe("auntie")
    expect(roots[0].children[1].isLastChild).toBe(true)
  })

  it("should add indexes for needs within the full tree", () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(roots[0].data.text).toBe("gramps")
    expect(roots[0].index).toBe(0)

    expect(roots[0].children[0].data.text).toBe("momma")
    expect(roots[0].children[0].index).toBe(1)

    expect(roots[0].children[0].children[0].data.text).toBe("grandkid")
    expect(roots[0].children[0].children[0].index).toBe(2)

    expect(roots[0].children[1].data.text).toBe("auntie")
    expect(roots[0].children[1].index).toBe(3)
  })

  it("should list need parents", () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(roots[0].data.text).toBe("gramps")
    expect(roots[0].index).toBe(0)

    expect(roots[0].children[0].data.text).toBe("momma")
    expect(roots[0].children[0].index).toBe(1)

    expect(roots[0].children[0].children[0].data.text).toBe("grandkid")
    expect(roots[0].children[0].children[0].index).toBe(2)

    expect(roots[0].children[1].data.text).toBe("auntie")
    expect(roots[0].children[1].index).toBe(3)
  })

  it("should ignore collapsed needs when generating the indexes", () => {
    const collapsedMomma: Kin = { ...momma, isCollapsed: true }
    const data = cloneDeep([auntie, grandkid, collapsedMomma, gramps])
    const { roots } = buildTree({ data, ...FUNCTIONS })

    expect(roots[0].data.text).toBe("gramps")
    expect(roots[0].children).toHaveLength(2)
    expect(roots[0].index).toBe(0)
    expect(roots[0].isCollapsed).toBe(false)

    expect(roots[0].children[0].data.text).toBe("momma")
    expect(roots[0].children[0].index).toBe(1)
    expect(roots[0].children[0].children).toHaveLength(0) // no subneeds if collapsed!
    expect(roots[0].children[0].isCollapsed).toBe(true)

    expect(roots[0].children[1].data.text).toBe("auntie")
    expect(roots[0].children[1].index).toBe(2)
    expect(roots[0].children[1].isCollapsed).toBe(false)
  })

  it("should provide updates for all needs", () => {
    const { orderUpdates } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    const updates = orderUpdates.reduce(
      (updates, { id, order }) => ({
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
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: gramps.id,
        siblings: roots,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.25)
    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: momma.id,
        siblings: roots[0].children,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.16666)
  })

  it("should set a larger order when we move an item after another", () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: gramps.id,
        siblings: roots,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.75)
    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: auntie.id,
        siblings: roots[0].children,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.8333)
  })

  it("should set an order between two items", () => {
    const { roots } = buildTree({ data: cloneDeep(DATA), ...FUNCTIONS })

    expect(
      placeWithinSiblings({
        direction: "after",
        relativeToId: momma.id,
        siblings: roots[0].children,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.5)
    expect(
      placeWithinSiblings({
        direction: "before",
        relativeToId: auntie.id,
        siblings: roots[0].children,
        ...FUNCTIONS,
      })
    ).toBeCloseTo(0.5)
  })
})
