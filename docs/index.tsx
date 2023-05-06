import { DocsApp } from "codedocs"
import React from "react"
import { render } from "react-dom"
import * as HomeDocs from "./Home.docs"
import { DebugToast, DebugDataProvider } from "~/Debug"
import * as OrderedListDocs from "~/OrderedList/OrderedList.docs"
import * as OrderedTreeDocs from "~/OrderedTree/OrderedTree.docs"

render(
  <>
    <DebugDataProvider>
      <DebugToast />
      <DocsApp
        logo="React Headless Accessible Hooks"
        icon="anchor"
        docs={[HomeDocs, OrderedTreeDocs, OrderedListDocs]}
      />
    </DebugDataProvider>
  </>,
  document.getElementById("root")
)
