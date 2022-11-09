/**
 * Creates a proxy object that matches the type of your React Context, but errors when you try to access anything on it.
 *
 * Useful as the argument to React.createContext, when you often don't have the state necessary to build a functioning context yet:
 *
 *        const MyContext = React.createContext(
 *          makeUninitializedContext<MyContextValue>(
 *            "MyContext cannot be used outside of <MyContext.Provider>"
 *          )
 *        )
 *
 * @param message Error message to throw when the context is used before being initialized
 * @returns a proxy object with whatever type you specify
 */
export function makeUninitializedContext<ContextType>(message: string) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "__isUninitializedContext") return true

        throw new Error(`${message}: tried getting context.${prop.toString()}`)
      },
    }
  ) as ContextType
}

type UnititializedContext = Record<string, unknown> & {
  __isUninitializedContext: true
}

/**
 * Tells you whether a React Context that was created with
 * `makeUninitializedContext` has been initialized or not. Useful when you want
 * to provide a fallback state for a hook that is allowed to be used outside of
 * the context provider:
 *
 *         export function useName() {
 *           const value = useContext(MyContext)
 *           return isInitialized(value) ? value.name : null
 *         }
 *
 * @param value a React Context value which may be an initialized
 * context, or a Proxy object returned by `makeUninitializedContext`
 * @returns false if `value` is the uninitialized Proxy object
 */
export function isInitialized(value: unknown) {
  if (typeof value !== "object") return true
  return !(value as UnititializedContext).__isUninitializedContext
}
