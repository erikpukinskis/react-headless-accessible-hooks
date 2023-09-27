Hooks to power complex interactive components, leaving the DOM and styles to you.

## Todo

Necessary for an V1 release:

**Select**

- [ ] Make close() a callback instead of a return value

**OrderedTree**

- [ ] Keyboard control
- [ ] Accessibility announce & roles
- [ ] Don't pause dragging while waiting for a fresh tree
- [ ] Figure out aria-activedescendant focus issue
- [ ] Allow `null` or `undefined` to be assed to `useOrderedTree` `data`

Maybes:

**OrderedTree**

- [ ] Expand nodes when you hover on them for a couple seconds
- [ ] Use portals to reparent placeholder and dropped node, to avoid a remount
- [ ] Multiplayer
- [ ] Support drag handles
- [ ] Auto-center dragging element
