Hooks to power complex interactive components, leaving the DOM and styles to you.

**Table of Contents**

- [Installation](#installation)
- [Design Principles](#design-principles)
- [`useOrderedTree`](#useorderedtree)
  - [Collapsible nodes](#collapsible-nodes)
  - [Filtering](#filtering)
  - [Clickable nodes](#clickable-nodes)
- [`useSelect`](#useselect)
- [`useAutocomplete`](#useautocomplete)
- [Todo](#todo)

## Installation

```
npm add react-headless-accessible-hooks
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
  updateEmployee: (update: Partial<Employee> => Promise<void>)
}

export const OrgChart: React.FC<OrgChartProps> = ({ employees, updateEmployee }) => {
  const { roots, getTreeProps, TreeProvider, getKey } = useOrderedTree<Person>({
    data: employees,
    getId: (person) => "[id]", // a unique id for each item
    getParentId: (person) => "[id]", // unique id for an item's parent
    getOrder: (person) => 1, // a numeric order for an item among its siblings
    compare: (personA, personB) => 0, // compare function for sorting items with no order
    isCollapsed: (person) => false, // true for expanded, false for collapsed
    onNodeMove: (id, newOrder, newParentId) => updateEmployee({ supervisorId: newParentId })
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

Lastly, it's recommended that you provide an `onBulkNodeOrder` handler which `useOrderedTree` will call in the case that some of your nodes are missing an explicit order—i.e. `getOrder` returns `null` for some nodes.

In that case, `useOrderedTree` will use your `compare` function as a fallback to sort the nodes, but this will effectively assign an implicit ordering. Then, if your user moves nodes around and the `onNodeMove` fires, it will be shooting off `order` numbers which are relative to that implicit ordering, and they won't be meaningful.

So if you provide that `onBulkNodeOrder` handler, you can persist the missing orders:

```ts
  const { roots, getTreeProps, TreeProvider, getKey } = useOrderedTree<Person>({
    ...
    onNodeMove: (id, newOrder, newParentId) => updateEmployee({ supervisorId: newParentId }),
    onBulkNodeOrder: (ordersById) => {
      /*
       * You want to use an efficient bulk endpoint for this, since there could
       * be hundreds of orders being set here.
       *
       * Assuming you are using a Prisma-like input to your endpoint:
       */
      const updates = Object.entries(ordersById).map(([id, order]) => ({
        where: { id },
        data: { seniority: order },
      }))
      void bulkUpdateEmployees({
        updates,
      })
    }
  })
```

### Collapsible nodes

If you want to make the nodes expandable and collapsible, you just have to handle those states in your row component:

```tsx
const OrgChartRow: React.FC<OrgChartRowProps> = ({ employee }) => {
  /* ... */
  if (expansion === "expanded") className += "expanded"
  if (expansion === "collapsed") className += "collapsed"

  return (
    <li key={getKey(employee)} className={className} {...getNodeProps()}>
      <DisclosureTriangle
        collapsed={expansion === "collapsed"}
        onClick={() => toggleCollapsed(employee.id)}
      />
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

It's up to you how you want to handle the UI for doing the collapse/expand. Typically you would have a disclosure triangle in your row component, which then updates some state that is read by your `isCollapsed` function.

### Filtering

Tree-aware filtering is available, which will filter out nodes for you that don't match certain criteria, but will still show the parents of any nodes that match your filters:

```ts
  const { roots, getTreeProps, TreeProvider, getKey } = useOrderedTree<Person>({
    ...
    isFilteredOut: (employee) => {
      employee.businessUnit === params.unit
    }
  })
```

### Clickable nodes

In order to accurately differentiate between clicks and very short drags, it's recommended that you let `useOrderedTree` handle click detection on nodes:

```ts
const { roots, getTreeProps, TreeProvider, getKey } = useOrderedTree<Person>({
  onClick: (employee) => {
    toggle(employee.id)
  },
})
```

## `useSelect`

Docs coming soon!

## `useAutocomplete`

Docs coming soon!

## Todo

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
