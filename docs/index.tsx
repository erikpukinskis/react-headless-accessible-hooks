import { DocsApp } from "codedocs"
import React from "react"
import { render } from "react-dom"
import * as HomeDocs from "./Home.docs"
import { DebugToast, DebugDataProvider } from "~/Debug"
import * as UseOrderedTreeDocs from "~/OrderedTree/OrderedTree.docs"
import * as UseOrderableListDocs from "~/useOrderableList.docs"

render(
  <>
    <DebugDataProvider>
      <DebugToast />
      <DocsApp
        logo="React Headless Accessible Hooks"
        icon="anchor"
        docs={[HomeDocs, UseOrderedTreeDocs, UseOrderableListDocs]}
      />
    </DebugDataProvider>
  </>,
  document.getElementById("root")
)
