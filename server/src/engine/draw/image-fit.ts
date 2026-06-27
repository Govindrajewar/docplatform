export interface ImageBox {
  /** Offset from the containing box's top-left corner (top-down). */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * Computes where to draw an image of `imageWidth`x`imageHeight` inside a `boxWidth`x`boxHeight`
 * box. `stretch` fills the box ignoring aspect ratio; `contain` scales to fit inside the box,
 * centered, preserving aspect ratio. `cover` is treated the same as `contain` — true crop-to-fill
 * would need a clipping path, which is out of scope for Phase 3 (documented limitation).
 */
export function computeImageBox(
  fit: 'contain' | 'cover' | 'stretch',
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
): ImageBox {
  if (fit === 'stretch' || imageWidth <= 0 || imageHeight <= 0) {
    return { offsetX: 0, offsetY: 0, width: boxWidth, height: boxHeight };
  }

  const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { offsetX: (boxWidth - width) / 2, offsetY: (boxHeight - height) / 2, width, height };
}
