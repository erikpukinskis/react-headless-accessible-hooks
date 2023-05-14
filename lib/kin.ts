import { startCase } from "lodash"

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
export function buildKin({ id, name, ...overrides }: KinOverrides) {
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
