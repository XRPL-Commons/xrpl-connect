import { getSafeImageUrl } from '../security';

/** Parse source-controlled markup that contains no runtime values. */
export function createStaticView(markup: TemplateStringsArray): DocumentFragment {
  if (markup.length !== 1) throw new Error('Static view templates cannot contain substitutions.');
  const template = document.createElement('template');
  template.innerHTML = markup[0];
  return template.content;
}

export function getViewElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`View template is missing required element: ${selector}`);
  return element;
}

export function createWalletImage(
  source: string | undefined,
  alternativeText: string,
  options: { className?: string; width?: number; height?: number } = {}
): HTMLImageElement | null {
  const safeSource = getSafeImageUrl(source);
  if (!safeSource) return null;

  const image = document.createElement('img');
  image.src = safeSource;
  image.alt = alternativeText;
  if (options.className) image.className = options.className;
  if (options.width !== undefined) image.width = options.width;
  if (options.height !== undefined) image.height = options.height;
  return image;
}
