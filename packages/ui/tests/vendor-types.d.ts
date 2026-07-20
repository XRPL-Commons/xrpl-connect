declare module 'canvas' {
  export class Canvas {}

  const canvas: unknown;
  export default canvas;
}

declare module 'jsdom' {
  export interface DOMWindow {}

  export class JSDOM {}
}
