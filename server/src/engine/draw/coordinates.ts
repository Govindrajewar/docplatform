/**
 * Layout coordinates are top-down from the page's top-left corner (like CSS); pdf-lib's drawing
 * primitives take a bottom-left-origin `y` for the *bottom* edge of whatever's being drawn. This
 * is the only place that conversion happens — everything upstream of the draw pass stays
 * top-down for clarity.
 */
export function toPdfBottomY(pageHeight: number, topDownTop: number, height: number): number {
  return pageHeight - topDownTop - height;
}
