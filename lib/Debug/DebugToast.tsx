import { styled } from "@stitches/react"
import React from "react"
import { useDebugData } from "./DebugDataContext"

const Toast = styled("div", {
  position: "fixed",
  width: 320,
  zIndex: 1,
  right: 16,
  bottom: 15,

  padding: 16,
  borderRadius: 6,
  background: "#2c2256",
  color: "#f18feb",
  boxShadow: "1px 2px 8px rgb(129 66 252 / 69%)",
  borderBottom: "2px solid #ab83a9",
  fontSize: "0.8em",
  opacity: 0.9,
  transition: "opacity 300ms, transform 300ms",

  variants: {
    closed: {
      true: {
        transform: "scale(0)",
        opacity: 0,
      },
    },
  },
})

export function DebugToast() {
  const data = useDebugData()

  const entries = Object.entries(data)

  return (
    <Toast closed={entries.length < 1}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <b>{key}</b> {value}
        </div>
      ))}
    </Toast>
  )
}
