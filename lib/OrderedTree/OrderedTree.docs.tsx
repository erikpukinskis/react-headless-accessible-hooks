import { styled } from "@stitches/react"
import { Doc, Demo } from "codedocs"
import React, { useState } from "react"
import type { OrderedTreeNode } from "./useOrderedTree"
import {
  useOrderedTree,
  useOrderedTreeNode,
  OrderedTreeProvider,
} from "./useOrderedTree"
import { useDumpDebugData } from "~/Debug"

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

export const FlatTree = <Demo render={Template} props={{ data: ORPHANS }} />

// export const WithCollapsedNode = (
//   <Demo
//     render={Template}
//     props={{ data: [GRAMPS, AUNTIE, MOMMA, KIDDO, TIO, COUSIN] }}
//   />
// )

type TemplateProps = {
  data: Kin[]
}

function Template({ data: initialData }: TemplateProps) {
  const [data, setData] = useState(initialData)

  const dump = useDumpDebugData()

  const { roots, getTreeProps, model } = useOrderedTree({
    data,
    onOrderChange(id, newOrder, newParentId) {
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

      setData(newArray)
    },
    getId: (kin) => kin.id,
    compare(a, b) {
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    },
    getParentId: (kin) => kin.parentId,
    getOrder: (kin) => kin.order,
    setOrder: (kin, order) => (kin.order = order),
    isCollapsed: (kin) => kin.isCollapsed,
    dump,
  })

  return (
    <Tree {...getTreeProps()}>
      <OrderedTreeProvider model={model}>
        {roots.map((node) => (
          <TreeRows key={node.key} node={node} />
        ))}
      </OrderedTreeProvider>
    </Tree>
  )
}

const Tree = styled("div", {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  width: "100%",
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
  node: OrderedTreeNode<Kin>
}

const TreeRows = ({ node }: TreeRowsProps) => {
  const {
    childNodes,
    getParentProps,
    depth,
    isBeingDragged,
    childIsBeingDragged,
  } = useOrderedTreeNode(node)

  if (node.isPlaceholder) {
    return (
      <Placeholder>
        <DepthIndicator
          id={node.id}
          depth={depth}
          isCollapsed={false}
          hasChildren={false}
        />
        <PlaceholderShadow>{node.data.name}</PlaceholderShadow>
      </Placeholder>
    )
  }

  const hasChildren =
    childNodes.length > 1 || (childNodes.length === 1 && !childIsBeingDragged)

  return (
    <>
      <DraggableRow {...getParentProps()} isBeingDragged={isBeingDragged}>
        {isBeingDragged || (
          <DepthIndicator
            id={node.id}
            depth={depth}
            isCollapsed={node.data.isCollapsed}
            hasChildren={hasChildren}
          />
        )}
        <span style={hasChildren ? { fontWeight: 500 } : undefined}>
          {node.data.name}
        </span>
      </DraggableRow>
      {childNodes.map((child) => (
        <TreeRows key={child.key} node={child} />
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
  isCollapsed: boolean
  hasChildren: boolean
}

const DepthIndicator = ({
  id,
  depth,
  isCollapsed,
  hasChildren,
}: DepthIndicatorProps) => {
  const emptyArray = Array(depth) as unknown[]
  const stars = [...emptyArray].map((_, i) => (
    <React.Fragment key={`depth-dot-${id}-${i}`}>
      {BULLET}
      {SPACE}
    </React.Fragment>
  ))

  return isCollapsed ? (
    <>
      {stars}
      {BLACK_RIGHT_POINTING_TRIANGLE}
      {SPACE}
    </>
  ) : hasChildren ? (
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
