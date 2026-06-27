import type { FieldDefinition, TemplateDocument, TemplateElement } from '@platform/shared';

import { FontRegistry } from '../fonts/font-registry';
import { resolveCheckboxState, resolveFieldValue } from '../resolver/field-resolver';
import { formatValue, substituteTokens } from '../resolver/tokens';
import { evaluateVisibleIf } from '../resolver/expression';
import type { DataContext } from '../types';

import {
  isTextLike,
  layoutTextBlock,
  resolveElementHeight,
  resolveElementWidth,
} from './element-box';
import type { PositionedElement } from './types';

export interface LayoutElementsResult {
  elements: PositionedElement[];
  /** Furthest bottom edge (origin-relative) reached by any laid-out element. */
  naturalHeight: number;
}

function isElementVisible(element: TemplateElement, context: DataContext): boolean {
  if (element.visibility === 'hidden') return false;
  if (element.visibleIf && !evaluateVisibleIf(element.visibleIf, context)) return false;
  return true;
}

/** Resolves the raw display string for a text-like or value-bearing element, before wrapping. */
function resolveElementText(
  element: TemplateElement,
  context: DataContext,
  fields: FieldDefinition[],
  missingFields: Set<string>,
): { text: string; checkboxState?: boolean } {
  switch (element.type) {
    case 'text':
      return { text: substituteTokens(element.value, context) };
    case 'staticText':
      return { text: element.value };
    case 'dynamicField': {
      const raw = resolveFieldValue(
        element.fieldKey,
        context,
        fields,
        element.requiredFieldBehavior,
        element.placeholder,
        missingFields,
      );
      return { text: formatValue(raw, element.format, element.formatOptions) };
    }
    case 'date': {
      const raw = resolveFieldValue(
        element.fieldKey,
        context,
        fields,
        undefined,
        undefined,
        missingFields,
      );
      return { text: formatValue(raw, 'date', { pattern: element.format }) };
    }
    case 'currency': {
      const raw = resolveFieldValue(
        element.fieldKey,
        context,
        fields,
        undefined,
        undefined,
        missingFields,
      );
      return {
        text: formatValue(raw, 'currency', {
          currencyCode: element.currencyCode,
          decimalPlaces: element.decimalPlaces,
          locale: element.locale,
        }),
      };
    }
    case 'checkbox': {
      const resolvedToken =
        typeof element.checked === 'string' ? substituteTokens(element.checked, context) : '';
      const state = resolveCheckboxState(element.checked, resolvedToken);
      return { text: state ? element.checkedGlyph : element.uncheckedGlyph, checkboxState: state };
    }
    case 'image':
      return { text: substituteTokens(element.src, context) };
    case 'signature':
      return { text: element.src ? substituteTokens(element.src, context) : '' };
    case 'qrcode':
    case 'barcode':
      return { text: substituteTokens(element.value, context) };
    default:
      return { text: '' };
  }
}

/**
 * Lays out a flat list of non-table elements within a container of `containerWidth`, using
 * each element's own `x`/`y` as an offset from the container's top-left origin. Returns
 * positions already translated to absolute page space via `originX`/`originY`, plus the
 * furthest bottom edge reached (used to size the container when its height isn't fixed).
 */
export async function layoutElements(
  elements: TemplateElement[],
  context: DataContext,
  template: TemplateDocument,
  fontRegistry: FontRegistry,
  containerWidth: number,
  originX: number,
  originY: number,
  missingFields: Set<string>,
): Promise<LayoutElementsResult> {
  const positioned: PositionedElement[] = [];
  let naturalHeight = 0;

  for (const element of elements) {
    if (!isElementVisible(element, context)) continue;

    const fontSize = element.fontSize ?? template.theme.baseFontSize;
    const width = resolveElementWidth(element, containerWidth);

    let lines: string[] = [];
    let resolvedText: string | undefined;
    let height: number;
    let checkboxState: boolean | undefined;
    let font;

    if (isTextLike(element) || element.type === 'checkbox') {
      const resolved = resolveElementText(element, context, template.fields, missingFields);
      resolvedText = resolved.text;
      checkboxState = resolved.checkboxState;
      font = await fontRegistry.resolve(element.font, element.fontWeight);

      if (isTextLike(element)) {
        const layoutOptions =
          element.type === 'text'
            ? { lineHeight: element.lineHeight, maxLines: element.maxLines }
            : {};
        const block = layoutTextBlock(resolvedText, font.pdfFont, fontSize, width, layoutOptions);
        lines = block.lines;
        height = resolveElementHeight(element, block.height);
      } else {
        lines = [resolvedText];
        height = resolveElementHeight(element);
      }
    } else {
      if (
        element.type === 'image' ||
        element.type === 'signature' ||
        element.type === 'qrcode' ||
        element.type === 'barcode'
      ) {
        resolvedText = resolveElementText(element, context, template.fields, missingFields).text;
      }
      height = resolveElementHeight(element);
    }

    positioned.push({
      element,
      resolvedText,
      lines,
      font,
      fontSize,
      checkboxState,
      x: originX + element.x,
      y: originY + element.y,
      width,
      height,
    });

    naturalHeight = Math.max(naturalHeight, element.y + height);
  }

  // Stable sort by zIndex for draw order; Array#sort is spec-guaranteed stable, so two elements
  // with the same zIndex keep their original JSON array order as the deterministic tiebreaker
  // (PRD 10 §10.5).
  positioned.sort((a, b) => a.element.zIndex - b.element.zIndex);

  return { elements: positioned, naturalHeight };
}
