import { create, type Font, type FontCollection } from 'fontkit';

export interface LoadedFont {
  /** CSS font-family the grid uses to draw real glyphs, or null if the browser rejected the font. */
  family: string | null;
  renderError: string | null;
  name: string;
  style: string;
  version: string;
  glyphCount: number;
  supported: Set<number>;
  /** Face names when the file is a collection (.ttc/.otc). */
  faces: string[] | null;
  faceIndex: number;
}

let loadCount = 0;
let activeFace: FontFace | null = null;

const isCollection = (f: Font | FontCollection): f is FontCollection => 'fonts' in f;

export async function loadFont(buffer: ArrayBuffer, faceIndex = 0): Promise<LoadedFont> {
  const parsed = create(new Uint8Array(buffer) as unknown as Buffer);
  let font: Font;
  let faceBuffer = buffer;
  let faces: string[] | null = null;

  if (isCollection(parsed)) {
    faces = parsed.fonts.map((f) => `${f.familyName} ${f.subfamilyName}`);
    font = parsed.fonts[faceIndex];
    // Browsers only render the first face of a collection, so hand
    // FontFace a standalone copy of the chosen face.
    if (isTtc(buffer)) faceBuffer = extractTtcFace(buffer, faceIndex);
  } else {
    font = parsed;
  }

  const family = `UserFont${++loadCount}`;
  let renderError: string | null = null;
  const face = new FontFace(family, faceBuffer);
  try {
    await face.load();
    if (activeFace) document.fonts.delete(activeFace);
    document.fonts.add(face);
    activeFace = face;
  } catch (e) {
    renderError = `The browser could not render this font (${(e as Error).message}). Coverage counts are still accurate.`;
  }

  return {
    family: renderError ? null : family,
    renderError,
    name: font.familyName,
    style: font.subfamilyName,
    version: font.version ? String(font.version) : '',
    glyphCount: font.numGlyphs,
    supported: new Set(font.characterSet),
    faces,
    faceIndex,
  };
}

function isTtc(buffer: ArrayBuffer): boolean {
  return new DataView(buffer).getUint32(0) === 0x74746366; // 'ttcf'
}

/** Rebuild one face of a TrueType/OpenType collection as a standalone sfnt. */
function extractTtcFace(buffer: ArrayBuffer, index: number): ArrayBuffer {
  const src = new DataView(buffer);
  const dirOffset = src.getUint32(12 + index * 4);
  const numTables = src.getUint16(dirOffset + 4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const rec = dirOffset + 12 + i * 16;
    tables.push({
      tag: src.getUint32(rec),
      checksum: src.getUint32(rec + 4),
      offset: src.getUint32(rec + 8),
      length: src.getUint32(rec + 12),
    });
  }

  const pad4 = (n: number) => (n + 3) & ~3;
  const headerSize = 12 + numTables * 16;
  const total = tables.reduce((sum, t) => sum + pad4(t.length), headerSize);
  const out = new Uint8Array(total);
  const dst = new DataView(out.buffer);

  // Offset table (sfntVersion + search params) is copied verbatim.
  out.set(new Uint8Array(buffer, dirOffset, 12), 0);
  let offset = headerSize;
  tables.forEach((t, i) => {
    const rec = 12 + i * 16;
    dst.setUint32(rec, t.tag);
    dst.setUint32(rec + 4, t.checksum);
    dst.setUint32(rec + 8, offset);
    dst.setUint32(rec + 12, t.length);
    out.set(new Uint8Array(buffer, t.offset, t.length), offset);
    offset += pad4(t.length);
  });
  return out.buffer;
}
