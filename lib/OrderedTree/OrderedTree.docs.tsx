import { keyframes, styled } from "@stitches/react"
import { Doc, Demo } from "codedocs"
import { kebabCase } from "lodash"
import React, { useCallback, useState } from "react"
import type { UseOrderedTreeArgs } from "./useOrderedTree"
import { useOrderedTree, useOrderedTreeNode } from "./useOrderedTree"
import { useDumpDebugData } from "~/Debug"
import { buildKin } from "~/kin"

export default (
  <Doc path="/Docs/OrderedTree">
    <p>For a tree of items that can be dragged into a different order.</p>

    <p>Assumptions:</p>

    <ul>
      <li>Tree elements are all the same height</li>
      <li>Items cannot be dragged into a collapsed tree node</li>
    </ul>
  </Doc>
)

type Kin = {
  id: string
  createdAt: string
  name: string
  parentId: null | string
  order: null | number
  isCollapsed: boolean
}

const GRAMPS: Kin = {
  id: "gramps",
  createdAt: "2022-01-01",
  name: "Gramps",
  parentId: null,
  order: null,
  isCollapsed: false,
}
const AUNTIE: Kin = {
  id: "auntie",
  createdAt: "2022-01-02",
  name: "Auntie",
  parentId: "gramps",
  order: null,
  isCollapsed: false,
}
const MOMMA: Kin = {
  id: "momma",
  createdAt: "2022-01-03",
  name: "Momma",
  parentId: "gramps",
  order: null,
  isCollapsed: false,
}
const KIDDO: Kin = {
  id: "kiddo",
  createdAt: "2022-01-04",
  name: "Kiddo",
  parentId: "momma",
  order: null,
  isCollapsed: false,
}
const TIO: Kin = {
  id: "tio",
  createdAt: "2022-01-05",
  name: "Tío",
  parentId: "gramps",
  order: null,
  isCollapsed: true,
}
const COUSIN: Kin = {
  id: "cousin",
  createdAt: "2022-01-06",
  name: "Cousin",
  parentId: "tio",
  order: null,
  isCollapsed: false,
}

const ORPHANS = [AUNTIE, MOMMA, TIO].map((sibling) => ({
  ...sibling,
  parentId: null,
  isCollapsed: false,
}))

// export const FlatTree = <Demo render={Template} props={{ data: ORPHANS }} />

const toRootNode = (kin: Kin) => ({ ...kin, parentId: null })

// export const WithChild = (
//   <Demo
//     render={Template}
//     props={{
//       data: [
//         { ...toRootNode(MOMMA), order: 0.2 },
//         KIDDO,
//         { ...toRootNode(AUNTIE), order: 0.4 },
//       ],
//     }}
//   />
// )

// export const WithCollapsedNode = (
//   <Demo
//     render={Template}
//     props={{ data: [GRAMPS, AUNTIE, MOMMA, KIDDO, TIO, COUSIN] }}
//   />
// )

export const Searchable = (
  <Demo
    render={() => {
      const [query, setQuery] = useState("")

      const isFilteredOut = useCallback(
        (kin: Kin) => {
          console.log("running filter")
          if (!query.trim()) return false

          const doesMatch = kebabCase(kin.name).includes(
            kebabCase(query.trim())
          )
          console.log(kin.name, doesMatch ? "matches" : "does not match", query)

          return !doesMatch
        },
        [query]
      )

      return (
        <div>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
          />
          <Template
            isFilteredOut={isFilteredOut}
            data={[
              buildKin({ id: "bananas" }),
              buildKin({ id: "green-banana", parentId: "bananas" }),
              buildKin({ id: "overripe-banana", parentId: "bananas" }),
              buildKin({ id: "cereals", isCollapsed: true }),
              buildKin({ id: "honey-nut-cheerios", parentId: "cereals" }),
              buildKin({ id: "cheerios", parentId: "cereals" }),
              buildKin({ id: "banana pops", parentId: "cereals" }),
            ]}
          />
        </div>
      )
    }}
  />
)

type OrderedTreeOverrides<Datum> = Partial<UseOrderedTreeArgs<Datum>> &
  Pick<UseOrderedTreeArgs<Datum>, "data">

function Template({
  data: initialData,
  ...overrides
}: OrderedTreeOverrides<Kin>) {
  const [data, setData] = useState(initialData)

  const dump = useDumpDebugData()

  const { roots, getTreeProps, TreeProvider, getKey, isDropping } =
    useOrderedTree({
      data,
      onNodeMove(id, newOrder, newParentId) {
        const index = data.findIndex((datum) => datum.id === id)
        const oldDatum = data[index]

        if (!oldDatum) {
          throw new Error(`Received order change for missing id ${id}`)
        }

        const newDatum = {
          ...oldDatum,
          order: newOrder,
          parentId: newParentId,
        }

        const newArray = [...data]
        newArray[index] = newDatum

        setTimeout(() => {
          setData(newArray)
        }, 500)
      },
      onBulkNodeOrder(ordersById) {
        setData(
          data.map((kin) => {
            const newOrder = ordersById[kin.id]

            if (newOrder === undefined) return kin

            return { ...kin, order: newOrder }
          })
        )
      },
      onClick(clickedKin) {
        setData((data) =>
          data.map((kin) => {
            if (kin.id !== clickedKin.id) {
              return kin
            }

            return {
              ...kin,
              isCollapsed: !kin.isCollapsed,
            }
          })
        )
      },
      getId: (kin) => kin.id,
      getParentId: (kin) => kin.parentId,
      getOrder: (kin) => kin.order,
      compare: (a: Kin, b: Kin) => {
        return new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
      },
      isCollapsed: (kin) => kin.isCollapsed,
      dump,
      ...overrides,
    })

  return (
    <Tree {...getTreeProps()} disabled={isDropping}>
      <TreeProvider>
        {roots.map((node) => (
          <TreeRows key={getKey(node)} kin={node} />
        ))}
      </TreeProvider>
      {isDropping && <Spinner role="status" />}
    </Tree>
  )
}

const spin = keyframes({
  to: { transform: "rotate(360deg)" },
})

const Spinner = styled("div", {
  position: "absolute",
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,

  "&:before": {
    content: "''",
    boxSizing: "border-box",
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "20px",
    height: "20px",
    marginTop: "-10px",
    marginLeft: "-10px",
    borderRadius: "50%",
    border: "1px solid #fff6a1",
    borderTopColor: "#7dcf7d",
    borderRightColor: "#9fc4c6",
    borderBottomColor: "#fff6a1",
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    animation: `${spin} .6s linear infinite`,
  },
})

const Tree = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: "100%",
  position: "relative",

  variants: {
    disabled: {
      true: {
        pointerEvents: "none",
        opacity: 0.5,
      },
    },
  },
})

const Row = styled("div", {
  padding: 8,
})

const DraggableRow = styled(Row, {
  cursor: "grab",
  userSelect: "none",
  ":active": { cursor: "grabbing" },

  variants: {
    isBeingDragged: {
      true: {
        position: "absolute",
        opacity: 0.1,
        boxShadow: "inset 0px 0px 0px 1px black",
      },
    },
  },
})

const Placeholder = styled(Row, {
  display: "flex",
  flexDirection: "row",
  borderRadius: 4,
})

const PlaceholderShadow = styled("div", {
  padding: 8,
  background: "#eee",
  borderRadius: 4,
  flexGrow: 1,
  margin: -8,
})

type TreeRowsProps = {
  kin: Kin
}

const TreeRows = ({ kin }: TreeRowsProps) => {
  const {
    children,
    getNodeProps,
    depth,
    isPlaceholder,
    isBeingDragged,
    expansion,
    getKey,
  } = useOrderedTreeNode(kin)

  if (isPlaceholder) {
    return (
      <Placeholder>
        <DepthIndicator id={kin.id} depth={depth} expansion={expansion} />
        <PlaceholderShadow>{kin.name}</PlaceholderShadow>
      </Placeholder>
    )
  }

  return (
    <>
      <DraggableRow {...getNodeProps()} isBeingDragged={isBeingDragged}>
        {isBeingDragged || (
          <DepthIndicator id={kin.id} depth={depth} expansion={expansion} />
        )}
        <span
          style={expansion === "no children" ? undefined : { fontWeight: 500 }}
        >
          {kin.name}
        </span>
      </DraggableRow>
      {children.map((child) => (
        <TreeRows key={getKey(child)} kin={child} />
      ))}
    </>
  )
}

const BULLET = <>&bull;</>
const BLACK_DOWN_POINTING_TRIANGLE = <>&#9660;</>
const BLACK_RIGHT_POINTING_TRIANGLE = <>&#9654;</>
const SPACE = <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</>

type DepthIndicatorProps = {
  id: string
  depth: number
  expansion: "expanded" | "collapsed" | "no children"
}

const DepthIndicator = ({ id, depth, expansion }: DepthIndicatorProps) => {
  const emptyArray = Array(depth) as unknown[]
  const stars = [...emptyArray].map((_, i) => (
    <React.Fragment key={`depth-dot-${id}-${i}`}>
      {BULLET}
      {SPACE}
    </React.Fragment>
  ))

  return expansion === "collapsed" ? (
    <>
      {stars}
      {BLACK_RIGHT_POINTING_TRIANGLE}
      {SPACE}
    </>
  ) : expansion === "expanded" ? (
    <>
      {stars}
      {BLACK_DOWN_POINTING_TRIANGLE}
      {SPACE}
    </>
  ) : (
    <>
      {stars}
      {BULLET}
      {SPACE}
    </>
  )
}
