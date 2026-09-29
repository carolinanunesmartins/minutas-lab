export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export function firstElementChild(el: Element, localName: string): Element | null {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) {
      const c = child as Element;
      if (c.namespaceURI === W_NS && c.localName === localName) return c;
    }
  }
  return null;
}

export function childElements(el: Element, localName?: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    if (localName === undefined || (c.namespaceURI === W_NS && c.localName === localName)) {
      out.push(c);
    }
  }
  return out;
}
