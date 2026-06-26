/**
 * Strips script-capable content from an uploaded SVG before it's stored — SVGs are XML and can
 * carry <script> tags or on*= event handlers, which would otherwise execute if ever rendered in
 * a browser context. See PRD 08 §8.1 (malicious file upload mitigation).
 */
export function sanitizeSvg(buffer: Buffer): Buffer {
  let svg = buffer.toString('utf-8');
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/\son\w+\s*=\s*"(?:[^"]*)"/gi, '');
  svg = svg.replace(/\son\w+\s*=\s*'(?:[^']*)'/gi, '');
  svg = svg.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, '');
  return Buffer.from(svg, 'utf-8');
}
