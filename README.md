Hooks to power complex interactive components, leaving the DOM and styles to you.

## Installation

```
npm add react-headless-accessible-hooks
yarn add react-headless-accessible-hooks
pnpm add react-headless-accessible-hooks
bun add react-headless-accessible-hooks
```

## Design Principles

The hooks in react-headless-accessible-hooks adhere to a few design principles:

1. **The hooks are headless**, meaning they don't create or style any DOM nodes. This allows you to style the elements however you like, using whatever infrastructure you already have for your components. It also makes them composeable.

2. We make **no presumptions about how your data is structured**. You don't need IDs of a certain type, you don't need to nest your data any particular way. You just provide functions which answer the questions we need to know:

   ```js
   useOrderedTree<Person>({
     getId: (person) => person.id,
     getParentId: (person) => parent.id,
     getOrder: (person) => person.placement.orderAmongSiblings,
     compare: ({ name: nameA }, { name: nameB }) => nameA < nameB ? -1 : nameB > nameA : – 1 : 0,
     isCollapsed: (person) => false,
     ...
   })
   ```

   and the hook asks those questions as needed.

<img alt="gif of nodes being dragged about" src="https://raw.githubusercontent.com/erikpukinskis/react-headless-accessible-hooks/main/docs/ordered-tree.gif" width="480" />

## `useOrderedTree`

Generally your tree will have two main components, the root component which draws the tree, and a row component which draws each node in the tree. In this example we'll create an `<OrgChart>` component with an `<OrgChartRow>`.

The root component will use the `useOrderedTree` hook to set up the tree:

```tsx
import { useOrderedTree } from "react-headless-accessible-hooks"

type Employee = {
  id: string
  name: string
  supervisorId: string
  startDate: string
}

type OrgChartProps = {
  employees: Employee[]
}

export const OrgChart: React.FC<OrgChartProps> = ({ employees }) => {
  const { roots, getTreeProps, TreeProvider, getKey } = useOrderedTree<Person>({
    data: employees,
    getId: (person) => "[id]", // a unique id for each item
    getParentId: (person) => "[id]", // unique id for an item's parent
    getOrder: (person) => 1, // a numeric order for an item among its siblings
    compare: (personA, personB) => 0, // compare function for sorting items with no order
    isCollapsed: (person) => false, // true for expanded, false for collapsed
  })

  return (
    <ul {...getTreeProps()}>
      <TreeProvider>
        {roots.map((root) => (
          <OrgChartRow key={getKey(root)} employee={root} />
        ))}
      </TreeProvider>
    </ul>
  )
}
```

... and the row component be render recursively and use the `useOrderedTreeNode` hook to track the state of a node and its children:

```tsx
import { useOrderedTreeNode } from "react-headless-accessible-hooks"

type OrgChartRowProps = {
  employee: Employee
}

const OrgChartRow: React.FC<OrgChartRowProps> = ({ employee }) => {
  const {
    children,
    getNodeProps,
    // depth,
    isPlaceholder,
    isBeingDragged,
    expansion,
    getKey,
  } = useOrderedTreeNode(kin)

  let className = "org-chart-row"

  // This will be true if we are mid-drag and this is a placeholder node at a potential drop location:
  if (isPlaceholder) className += " placeholder"

  // Will be true if we are mid-drag and this is the original location of the node:
  if (isBeingDragged) className += "is-being-dragged"

  return (
    <li key={getKey(employee)} className={className} {...getNodeProps()}>
      {employee.name}
      <ul>
        {children.map((directReport) => (
          <OrgChartRow key={getKey(directReport)} employee={directReport} />
        )}
      </ul>
    </li>
  )
}
```

If you want to make the nodes expandable and collapsible, you just have to handle those cases in your row component:

```tsx
const OrgChartRow: React.FC<OrgChartRowProps> = ({ employee }) => {
  /* ... */
  if (expansion === "expanded") className += "expanded"
  if (expansion === "collapsed") className += "collapsed"

  return (
    <li key={getKey(employee)} className={className} {...getNodeProps()}>
      {employee.name}
      {expansion === "expanded" && (
        <ul>
          {children.map((directReport) => (
            <OrgChartRow key={getKey(directReport)} employee={directReport} />
          )}
        </ul>
      )}
    </li>
  )
}
```

## `useSelect`

Docs coming soon!

## `useAutocomplete`

Docs coming soon!

## Todo

### Ordered Tree

Necessary for an V1 release:

- [ ] Keyboard control
- [ ] Accessibility announce & roles
- [ ] Don't pause dragging while waiting for a fresh tree
- [ ] Figure out aria-activedescendant focus issue
- [ ] Allow `null` or `undefined` to be assed to `useOrderedTree` `data`

Maybes:

- [ ] Expand nodes when you hover on them for a couple seconds
- [ ] Use portals to reparent placeholder and dropped node, to avoid a remount
- [ ] Multiplayer
- [ ] Support drag handles
- [ ] Auto-center dragging element
- [ ] `useOrderedList` hook
