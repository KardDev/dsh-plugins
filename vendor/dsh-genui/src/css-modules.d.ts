/** CSS Modules: bundlers compile *.module.css to a hashed class map. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
