import { DocsApp } from "codedocs"
import React from "react"
import { render } from "react-dom"
import * as Home from "./Home.docs"

render(
  <DocsApp logo="React Headless Accessible Hooks" docs={[Home]} />,
  document.getElementById("root")
)
