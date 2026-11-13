import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type {
  ParsingIssue,
  PresentationAsset,
  PresentationDraft,
  PresentationSlide,
  SlideBackground,
  SlideElement,
  SlideImageCrop,
  SlideParagraph,
  SlideTableCell,
  SlideTextElement,
  SlideTextRun,
} from '@/types/domain';
import { uid } from '@/lib/utils';

/**
 * Local PowerPoint reader.
 *
 * A browser cannot reproduce PowerPoint rendering exactly without a full
 * layout engine. This parser extracts the information needed for an
 * approximate but faithful stage: slide order, background colours/images,
 * text boxes with position, font and colour, pictures with crop, and simple
 * tables. The original .pptx is never persisted or uploaded.
 */

export const MAX_PPTX_BYTES = 60 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 45 * 1024 * 1024;
const MAX_SLIDE_TEXT_CHARS = 8_000;
const EMU_PER_PT = 12_700;
const DEFAULT_SLIDE_WIDTH = 12_192_000;
const DEFAULT_SLIDE_HEIGHT = 6_858_000;

const DEFAULT_PALETTE: ThemePalette = {
  dk1: '#1f2937',
  lt1: '#ffffff',
  dk2: '#374151',
  lt2: '#f3f4f6',
  accent1: '#4472c4',
  accent2: '#ed7d31',
  accent3: '#a5a5a5',
  accent4: '#ffc000',
  accent5: '#5b9bd5',
  accent6: '#70ad47',
  hlink: '#0563c1',
  folHlink: '#954f72',
};

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

export class PresentationParseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PresentationParseError';
    this.code = code;
  }
}

export interface PresentationParseProgress {
  value: number;
  stage: string;
  message: string;
}

export interface ParsePresentationOptions {
  fileName?: string;
  fileSize?: number;
  onProgress?: (progress: PresentationParseProgress) => void;
}

/* ------------------------------------------------------------------ */
/* Ordered XML helpers                                                 */
/* ------------------------------------------------------------------ */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  processEntities: true,
});

interface OrderedEntry {
  [key: string]: unknown;
}

interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: OrderedEntry[];
  text?: string;
}

function stripPrefix(name: string): string {
  const index = name.indexOf(':');
  return index >= 0 ? name.slice(index + 1) : name;
}

function normalizeAttrs(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    const name = key.startsWith('@_') ? key.slice(2) : key;
    result[name] = String(value);
  }
  return result;
}

function toNodes(raw: unknown): XNode[] {
  if (!Array.isArray(raw)) return [];
  const nodes: XNode[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as OrderedEntry;
    if (record[':@'] && Object.keys(record).length === 1) {
      if (nodes.length) nodes[nodes.length - 1].attrs = normalizeAttrs(record[':@']);
      continue;
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === ':@') continue;
      if (key === '#text') {
        nodes.push({ name: '#text', attrs: {}, children: [], text: String(value ?? '') });
        continue;
      }
      if (key.startsWith('#')) continue;
      nodes.push({
        name: stripPrefix(key),
        attrs: normalizeAttrs(record[':@']),
        children: Array.isArray(value) ? (value as OrderedEntry[]) : [],
      });
    }
  }
  return nodes;
}

function childNodes(node: XNode | undefined | null): XNode[] {
  return node ? toNodes(node.children) : [];
}

function findChild(node: XNode | undefined | null, name: string): XNode | undefined {
  return childNodes(node).find((child) => child.name === name);
}

function findChildren(node: XNode | undefined | null, name: string): XNode[] {
  return childNodes(node).filter((child) => child.name === name);
}

function attr(node: XNode | undefined | null, name: string): string | undefined {
  return node?.attrs[name];
}

function numAttr(node: XNode | undefined | null, name: string, fallback?: number): number | undefined {
  const raw = attr(node, name);
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function isTruthy(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'on';
}

function nodeText(node: XNode | undefined | null): string {
  if (!node) return '';
  if (node.name === '#text') return node.text ?? '';
  return childNodes(node)
    .map((child) => nodeText(child))
    .join('');
}

function parseXml(text: string): XNode[] {
  return toNodes(xmlParser.parse(text));
}

async function readXmlPart(zip: JSZip, path: string): Promise<XNode[] | null> {
  const file = zip.file(path);
  if (!file) return null;
  const text = await file.async('text');
  try {
    return parseXml(text);
  } catch {
    return null;
  }
}

function rootNode(nodes: XNode[] | null, name: string): XNode | undefined {
  return nodes?.find((node) => node.name === name);
}

/* ------------------------------------------------------------------ */
/* Package paths and relationships                                     */
/* ------------------------------------------------------------------ */

interface Relationship {
  id: string;
  target: string;
  type: string;
  mode?: string;
}

function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  if (slash < 0) return `_rels/${partPath}.rels`;
  return `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
}

function resolvePartPath(sourcePart: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
  if (target.startsWith('/')) return target.slice(1);
  const base = sourcePart.slice(0, sourcePart.lastIndexOf('/')).split('/').filter(Boolean);
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') base.pop();
    else base.push(segment);
  }
  return base.join('/');
}

async function readRelationships(zip: JSZip, partPath: string): Promise<Map<string, Relationship>> {
  const nodes = await readXmlPart(zip, relsPathFor(partPath));
  const result = new Map<string, Relationship>();
  const root = rootNode(nodes, 'Relationships');
  if (!root) return result;
  for (const rel of findChildren(root, 'Relationship')) {
    const id = attr(rel, 'Id');
    const target = attr(rel, 'Target');
    if (!id || !target) continue;
    result.set(id, {
      id,
      target,
      type: attr(rel, 'Type') ?? '',
      mode: attr(rel, 'TargetMode'),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

interface ThemePalette {
  dk1: string;
  lt1: string;
  dk2: string;
  lt2: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;
  accent6: string;
  hlink: string;
  folHlink: string;
  [key: string]: string;
}

function hex(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/^#/, '').trim();
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  if (/^[0-9a-f]{8}$/i.test(cleaned)) return `#${cleaned.slice(-6).toLowerCase()}`;
  return undefined;
}

function colorFromColorNode(node: XNode | undefined, palette: ThemePalette): string | undefined {
  if (!node) return undefined;
  const srgb = findChild(node, 'srgbClr');
  if (srgb) return hex(attr(srgb, 'val'));
  const sys = findChild(node, 'sysClr');
  if (sys) return hex(attr(sys, 'lastClr') ?? attr(sys, 'val'));
  const scheme = findChild(node, 'schemeClr');
  if (scheme) {
    const key = attr(scheme, 'val') ?? '';
    const mapped = palette[key];
    if (mapped) return mapped;
    if (key === 'phClr') return palette.accent1;
  }
  const preset = findChild(node, 'prstClr');
  if (preset) {
    const name = (attr(preset, 'val') ?? '').toLowerCase();
    const presets: Record<string, string> = {
      black: '#000000',
      white: '#ffffff',
      red: '#ff0000',
      green: '#008000',
      blue: '#0000ff',
      yellow: '#ffff00',
      gray: '#808080',
      grey: '#808080',
      orange: '#ffa500',
    };
    if (presets[name]) return presets[name];
  }
  return undefined;
}

function colorFromFill(fill: XNode | undefined, palette: ThemePalette): string | undefined {
  if (!fill) return undefined;
  const direct = colorFromColorNode(fill, palette);
  if (direct) return direct;
  const solid = fill.name === 'solidFill' ? fill : findChild(fill, 'solidFill');
  if (solid) {
    const solidColor = colorFromColorNode(solid, palette);
    if (solidColor) return solidColor;
  }
  const gradient = fill.name === 'gradFill' ? fill : findChild(fill, 'gradFill');
  if (gradient) {
    const list = findChild(gradient, 'gsLst');
    const stop = findChild(list, 'gs');
    const stopColor = colorFromColorNode(stop, palette);
    if (stopColor) return stopColor;
  }
  return undefined;
}

async function loadThemePalette(zip: JSZip, presentationRels: Map<string, Relationship>): Promise<ThemePalette> {
  const themeRel = [...presentationRels.values()].find((rel) => rel.type.endsWith('/theme'));
  const path = themeRel ? resolvePartPath('ppt/presentation.xml', themeRel.target) : 'ppt/theme/theme1.xml';
  const nodes = await readXmlPart(zip, path);
  const theme = rootNode(nodes, 'theme');
  const scheme = findChild(findChild(theme, 'themeElements'), 'clrScheme');
  if (!scheme) return { ...DEFAULT_PALETTE };
  const palette: ThemePalette = { ...DEFAULT_PALETTE };
  for (const key of Object.keys(DEFAULT_PALETTE)) {
    const entry = findChild(scheme, key);
    const value = colorFromColorNode(entry, palette);
    if (value) palette[key] = value;
  }
  return palette;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

interface RectEmu {
  x: number;
  y: number;
  w: number;
  h: number;
}

type RectMapper = (rect: RectEmu) => RectEmu;

const identityMapper: RectMapper = (rect) => rect;

function readRect(xfrm: XNode | undefined): RectEmu | null {
  if (!xfrm) return null;
  const offset = findChild(xfrm, 'off');
  const extent = findChild(xfrm, 'ext');
  if (!offset || !extent) return null;
  const x = numAttr(offset, 'x', 0) ?? 0;
  const y = numAttr(offset, 'y', 0) ?? 0;
  const w = numAttr(extent, 'cx', 0) ?? 0;
  const h = numAttr(extent, 'cy', 0) ?? 0;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function normaliseRect(rect: RectEmu, widthEmu: number, heightEmu: number) {
  return {
    x: rect.x / widthEmu,
    y: rect.y / heightEmu,
    width: rect.w / widthEmu,
    height: rect.h / heightEmu,
  };
}

function groupMapper(group: XNode, parent: RectMapper): RectMapper {
  const groupPr = findChild(group, 'grpSpPr');
  const xfrm = findChild(groupPr, 'xfrm');
  if (!xfrm) return parent;
  const off = findChild(xfrm, 'off');
  const ext = findChild(xfrm, 'ext');
  const chOff = findChild(xfrm, 'chOff');
  const chExt = findChild(xfrm, 'chExt');
  if (!off || !ext || !chOff || !chExt) return parent;
  const offX = numAttr(off, 'x', 0) ?? 0;
  const offY = numAttr(off, 'y', 0) ?? 0;
  const extW = numAttr(ext, 'cx', 0) ?? 0;
  const extH = numAttr(ext, 'cy', 0) ?? 0;
  const chX = numAttr(chOff, 'x', 0) ?? 0;
  const chY = numAttr(chOff, 'y', 0) ?? 0;
  const chW = numAttr(chExt, 'cx', 0) ?? 0;
  const chH = numAttr(chExt, 'cy', 0) ?? 0;
  if (chW <= 0 || chH <= 0) return parent;
  const scaleX = extW / chW;
  const scaleY = extH / chH;
  return (rect) =>
    parent({
      x: offX + (rect.x - chX) * scaleX,
      y: offY + (rect.y - chY) * scaleY,
      w: rect.w * scaleX,
      h: rect.h * scaleY,
    });
}

/* ------------------------------------------------------------------ */
/* Placeholder defaults (inherited from slide layouts/masters)         */
/* ------------------------------------------------------------------ */

interface PlaceholderDefaults {
  rect?: RectEmu;
  fontSizes: Array<number | undefined>;
  anchor?: 'top' | 'middle' | 'bottom';
}

interface LayoutInfo {
  placeholders: Map<string, PlaceholderDefaults>;
  background?: SlideBackground;
}

function parsePlaceholderDefaults(shape: XNode): PlaceholderDefaults {
  const fontSizes: Array<number | undefined> = [];
  const txBody = findChild(shape, 'txBody');
  const listStyle = findChild(txBody, 'lstStyle');
  for (let level = 1; level <= 9; level += 1) {
    const levelStyle = findChild(listStyle, `lvl${level}pPr`);
    const defRPr = findChild(levelStyle, 'defRPr');
    const size = numAttr(defRPr, 'sz');
    fontSizes.push(size != null ? size / 100 : undefined);
  }
  const hasLevelSize = fontSizes.some((value) => value != null);
  if (!hasLevelSize) {
    const firstParagraph = findChild(txBody, 'p');
    const defRPr = findChild(findChild(firstParagraph, 'pPr'), 'defRPr');
    const fallback = numAttr(defRPr, 'sz');
    if (fallback != null) fontSizes.splice(0, 1, fallback / 100);
  }
  const bodyPr = findChild(txBody, 'bodyPr');
  const anchorRaw = attr(bodyPr, 'anchor');
  const anchor = anchorRaw === 'ctr' ? 'middle' : anchorRaw === 'b' ? 'bottom' : anchorRaw === 't' ? 'top' : undefined;
  return {
    rect: readRect(findChild(findChild(shape, 'spPr'), 'xfrm')) ?? undefined,
    fontSizes,
    anchor,
  };
}

function placeholderKeys(shape: XNode): string[] {
  const ph = findChild(findChild(shape, 'nvSpPr'), 'nvPr');
  const placeholder = findChild(ph, 'ph');
  if (!placeholder) return [];
  const keys: string[] = [];
  const idx = attr(placeholder, 'idx');
  const type = attr(placeholder, 'type');
  if (idx != null) keys.push(`idx:${idx}`);
  if (type) keys.push(`type:${type}`);
  return keys;
}

function collectPlaceholders(shapeTree: XNode | undefined): Map<string, PlaceholderDefaults> {
  const map = new Map<string, PlaceholderDefaults>();
  if (!shapeTree) return map;
  for (const shape of findChildren(shapeTree, 'sp')) {
    const keys = placeholderKeys(shape);
    if (!keys.length) continue;
    const defaults = parsePlaceholderDefaults(shape);
    for (const key of keys) map.set(key, defaults);
  }
  return map;
}

async function backgroundFromShapeTree(
  root: XNode | undefined,
  partPath: string,
  ctx: ParserContext,
): Promise<SlideBackground | undefined> {
  const cSld = findChild(root, 'cSld');
  const bg = findChild(cSld, 'bg');
  if (!bg) return undefined;
  const bgPr = findChild(bg, 'bgPr');
  if (bgPr) {
    const color = colorFromFill(bgPr, ctx.palette);
    const blipFill = findChild(bgPr, 'blipFill');
    if (blipFill) {
      const embed = attr(findChild(blipFill, 'blip'), 'r:embed');
      const assetId = embed ? await ctx.assetForRel(partPath, embed) : undefined;
      if (assetId) return { color, assetId };
    }
    return color ? { color } : undefined;
  }
  const bgRef = findChild(bg, 'bgRef');
  const color = colorFromColorNode(bgRef, ctx.palette);
  return color ? { color } : undefined;
}

/* ------------------------------------------------------------------ */
/* Parser context and image assets                                     */
/* ------------------------------------------------------------------ */

interface ParserContext {
  zip: JSZip;
  palette: ThemePalette;
  slideWidthEmu: number;
  slideHeightEmu: number;
  warnings: ParsingIssue[];
  assets: PresentationAsset[];
  assetByPath: Map<string, string>;
  totalAssetBytes: number;
  relCache: Map<string, Promise<Map<string, Relationship>>>;
  layoutCache: Map<string, Promise<LayoutInfo>>;
  warn: (code: string, message: string, severity?: ParsingIssue['severity']) => void;
  getRels: (partPath: string) => Promise<Map<string, Relationship>>;
  assetForRel: (partPath: string, relationshipId: string | undefined) => Promise<string | undefined>;
  getLayout: (path: string) => Promise<LayoutInfo>;
}

function createContext(
  zip: JSZip,
  palette: ThemePalette,
  slideWidthEmu: number,
  slideHeightEmu: number,
): ParserContext {
  const warnings: ParsingIssue[] = [];
  const warningKeys = new Set<string>();
  const assets: PresentationAsset[] = [];
  const assetByPath = new Map<string, string>();
  const relCache = new Map<string, Promise<Map<string, Relationship>>>();
  const layoutCache = new Map<string, Promise<LayoutInfo>>();

  const ctx: ParserContext = {
    zip,
    palette,
    slideWidthEmu,
    slideHeightEmu,
    warnings,
    assets,
    assetByPath,
    totalAssetBytes: 0,
    relCache,
    layoutCache,
    warn(code, message, severity = 'warning') {
      const key = `${code}:${message}`;
      if (warningKeys.has(key)) return;
      warningKeys.add(key);
      warnings.push({ code, message, severity });
    },
    getRels(partPath) {
      const cached = relCache.get(partPath);
      if (cached) return cached;
      const promise = readRelationships(zip, partPath);
      relCache.set(partPath, promise);
      return promise;
    },
    async assetForRel(partPath, relationshipId) {
      if (!relationshipId) return undefined;
      const rels = await ctx.getRels(partPath);
      const rel = rels.get(relationshipId);
      if (!rel || rel.mode === 'External') return undefined;
      const path = resolvePartPath(partPath, rel.target);
      return loadImageAsset(path, ctx);
    },
    getLayout(path) {
      const cached = layoutCache.get(path);
      if (cached) return cached;
      const promise = loadLayoutInfo(path, ctx);
      layoutCache.set(path, promise);
      return promise;
    },
  };
  return ctx;
}

async function loadImageAsset(path: string, ctx: ParserContext): Promise<string | undefined> {
  const existing = ctx.assetByPath.get(path);
  if (existing) return existing || undefined;
  const file = ctx.zip.file(path);
  if (!file) {
    ctx.warn('image_missing', `Không tìm thấy ảnh ${path.split('/').pop() ?? path} trong file PPTX.`);
    ctx.assetByPath.set(path, '');
    return undefined;
  }
  const extension = (path.split('.').pop() ?? '').toLowerCase();
  const mimeType = IMAGE_MIME[extension];
  if (!mimeType) {
    ctx.warn(
      'image_unsupported',
      `Ảnh ${extension.toUpperCase() || 'không rõ định dạng'} trong slide chưa được trình duyệt hỗ trợ nên được bỏ qua.`,
      'info',
    );
    ctx.assetByPath.set(path, '');
    return undefined;
  }
  const raw = await file.async('blob');
  if (raw.size > MAX_IMAGE_BYTES) {
    ctx.warn(
      'image_too_large',
      `Một ảnh trong slide lớn hơn ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB nên được bỏ qua để tránh đầy bộ nhớ.`,
    );
    ctx.assetByPath.set(path, '');
    return undefined;
  }
  if (ctx.totalAssetBytes + raw.size > MAX_TOTAL_IMAGE_BYTES) {
    ctx.warn(
      'images_budget',
      `Tổng dung lượng ảnh vượt ${Math.round(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024)}MB; một số ảnh sau được bỏ qua.`,
    );
    ctx.assetByPath.set(path, '');
    return undefined;
  }
  const asset: PresentationAsset = {
    id: uid('slide_asset'),
    partPath: path,
    mimeType,
    size: raw.size,
    blob: raw.type === mimeType ? raw : new Blob([raw], { type: mimeType }),
  };
  ctx.assets.push(asset);
  ctx.assetByPath.set(path, asset.id);
  ctx.totalAssetBytes += raw.size;
  return asset.id;
}

async function loadLayoutInfo(path: string, ctx: ParserContext): Promise<LayoutInfo> {
  const nodes = await readXmlPart(ctx.zip, path);
  const layout = rootNode(nodes, 'sldLayout');
  if (!layout) return { placeholders: new Map() };

  const rels = await ctx.getRels(path);
  const masterRel = [...rels.values()].find((rel) => rel.type.endsWith('/slideMaster'));
  const masterPath = masterRel ? resolvePartPath(path, masterRel.target) : null;
  let masterPlaceholders = new Map<string, PlaceholderDefaults>();
  let masterBackground: SlideBackground | undefined;

  if (masterPath) {
    const masterNodes = await readXmlPart(ctx.zip, masterPath);
    const master = rootNode(masterNodes, 'sldMaster');
    if (master) {
      masterPlaceholders = collectPlaceholders(findChild(findChild(master, 'cSld'), 'spTree'));
      masterBackground = await backgroundFromShapeTree(master, masterPath, ctx);
    }
  }

  const placeholders = new Map(masterPlaceholders);
  for (const [key, value] of collectPlaceholders(findChild(findChild(layout, 'cSld'), 'spTree'))) {
    // PowerPoint layouts normally omit xfrm, font size and anchor for
    // placeholders whose geometry is inherited from the slide master. A
    // plain `set` would overwrite the master defaults with undefined and
    // drop every placeholder shape from the slide.
    const base = placeholders.get(key);
    placeholders.set(key, {
      rect: value.rect ?? base?.rect,
      fontSizes: value.fontSizes.map((size, level) => size ?? base?.fontSizes[level]),
      anchor: value.anchor ?? base?.anchor,
    });
  }
  const layoutBackground = await backgroundFromShapeTree(layout, path, ctx);
  return { placeholders, background: layoutBackground ?? masterBackground };
}

/* ------------------------------------------------------------------ */
/* Text / tables                                                       */
/* ------------------------------------------------------------------ */

function mapAlignment(value: string | undefined): SlideParagraph['align'] {
  if (value === 'ctr') return 'center';
  if (value === 'r') return 'right';
  if (value === 'just' || value === 'dist') return 'justify';
  return 'left';
}

function runFromNode(
  runNode: XNode,
  paragraphDefaults: XNode | undefined,
  placeholder: PlaceholderDefaults | undefined,
  level: number,
  palette: ThemePalette,
): SlideTextRun | null {
  const text = nodeText(findChild(runNode, 't'));
  if (!text) return null;
  const rPr = findChild(runNode, 'rPr');
  const defRPr = findChild(paragraphDefaults, 'defRPr');
  const directSize = numAttr(rPr, 'sz');
  const defaultSize = numAttr(defRPr, 'sz');
  const inheritedSize = placeholder?.fontSizes[level] ?? placeholder?.fontSizes[0];
  const fontSizePt =
    directSize != null ? directSize / 100 : defaultSize != null ? defaultSize / 100 : inheritedSize;
  const color =
    colorFromFill(findChild(rPr, 'solidFill'), palette) ??
    colorFromFill(findChild(defRPr, 'solidFill'), palette);
  const typeface = attr(findChild(rPr, 'latin'), 'typeface') ?? attr(findChild(defRPr, 'latin'), 'typeface');
  const underlineRaw = attr(rPr, 'u') ?? attr(defRPr, 'u');
  return {
    text,
    bold: isTruthy(attr(rPr, 'b') ?? attr(defRPr, 'b')),
    italic: isTruthy(attr(rPr, 'i') ?? attr(defRPr, 'i')),
    underline: Boolean(underlineRaw && underlineRaw !== 'none'),
    color,
    fontSizePt,
    fontFamily: typeface && !typeface.startsWith('+') ? typeface : undefined,
  };
}

function readParagraphs(
  txBody: XNode | undefined,
  placeholder: PlaceholderDefaults | undefined,
  palette: ThemePalette,
): SlideParagraph[] {
  if (!txBody) return [];
  const paragraphs: SlideParagraph[] = [];
  for (const paragraph of findChildren(txBody, 'p')) {
    const pPr = findChild(paragraph, 'pPr');
    const levelRaw = numAttr(pPr, 'lvl', 0) ?? 0;
    const level = Math.max(0, Math.min(8, Math.round(levelRaw)));
    const bullet =
      Boolean(findChild(pPr, 'buChar') || findChild(pPr, 'buAutoNum')) && !findChild(pPr, 'buNone');
    const runs: SlideTextRun[] = [];
    for (const node of childNodes(paragraph)) {
      if (node.name === 'r' || node.name === 'fld') {
        const run = runFromNode(node, pPr, placeholder, level, palette);
        if (run) runs.push(run);
      } else if (node.name === 'br') {
        runs.push({ text: '\n' });
      }
    }
    if (!runs.some((run) => run.text.trim().length)) continue;
    paragraphs.push({
      runs,
      align: mapAlignment(attr(pPr, 'algn')),
      level,
      bullet,
    });
  }
  return paragraphs;
}

function textFromParagraphs(paragraphs: SlideParagraph[]): string {
  return paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n')
    .replace(/\u000b/g, '\n')
    .trim();
}

function readTable(graphicFrame: XNode, palette: ThemePalette): SlideElement | null {
  const graphic = findChild(graphicFrame, 'graphic');
  const graphicData = findChild(graphic, 'graphicData');
  const table = findChild(graphicData, 'tbl');
  if (!table) return null;
  const rect = readRect(findChild(graphicFrame, 'xfrm'));
  if (!rect) return null;
  const rows: SlideTableCell[][] = [];
  for (const row of findChildren(table, 'tr')) {
    const cells: SlideTableCell[] = [];
    for (const cell of findChildren(row, 'tc')) {
      const paragraphs = readParagraphs(findChild(cell, 'txBody'), undefined, palette);
      const firstRun = paragraphs.flatMap((paragraph) => paragraph.runs).find((run) => run.text.trim());
      cells.push({
        text: textFromParagraphs(paragraphs),
        bold: firstRun?.bold,
      });
    }
    rows.push(cells);
  }
  if (!rows.length) return null;
  const widthsRaw = findChildren(findChild(table, 'tblGrid'), 'gridCol')
    .map((column) => numAttr(column, 'w', 1) ?? 1)
    .filter((value) => value > 0);
  const totalWidth = widthsRaw.reduce((sum, value) => sum + value, 0);
  const columnWidths = widthsRaw.length
    ? widthsRaw.map((value) => value / totalWidth)
    : Array.from({ length: rows[0]?.length || 1 }, () => 1 / (rows[0]?.length || 1));
  const heightsRaw = findChildren(table, 'tr').map((row) => numAttr(row, 'h', 1) ?? 1);
  const totalHeight = heightsRaw.reduce((sum, value) => sum + value, 0);
  return {
    kind: 'table',
    id: uid('slide_table'),
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    rows,
    columnWidths,
    rowHeights: totalHeight > 0 ? heightsRaw.map((value) => value / totalHeight) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

function placeholderFor(
  shape: XNode,
  layout: LayoutInfo,
): { type?: string; defaults?: PlaceholderDefaults } {
  const placeholder = findChild(findChild(shape, 'nvSpPr'), 'nvPr');
  const ph = findChild(placeholder, 'ph');
  if (!ph) return {};
  const type = attr(ph, 'type');
  const idx = attr(ph, 'idx');
  const defaults =
    (idx != null ? layout.placeholders.get(`idx:${idx}`) : undefined) ??
    (type ? layout.placeholders.get(`type:${type}`) : undefined);
  return { type, defaults };
}

function fillAndBorder(shapePr: XNode | undefined, palette: ThemePalette) {
  const fill = colorFromFill(shapePr, palette);
  const line = findChild(shapePr, 'ln');
  const borderColor = colorFromFill(findChild(line, 'solidFill'), palette);
  const borderWidthEmu = numAttr(line, 'w', 0) ?? 0;
  return {
    fill,
    borderColor,
    borderWidthPt: borderColor ? Math.max(0.75, borderWidthEmu / EMU_PER_PT) : undefined,
  };
}

async function parseShape(
  shape: XNode,
  mapper: RectMapper,
  partPath: string,
  ctx: ParserContext,
  layout: LayoutInfo,
): Promise<SlideElement | null> {
  const placeholder = placeholderFor(shape, layout);
  if (placeholder.type === 'sldNum' || placeholder.type === 'ftr' || placeholder.type === 'dt') return null;
  const shapePr = findChild(shape, 'spPr');
  const xfrm = findChild(shapePr, 'xfrm');
  const rawRect = readRect(xfrm) ?? placeholder.defaults?.rect;
  if (!rawRect) return null;
  const rect = mapper(rawRect);
  if (rect.w <= 0 || rect.h <= 0) return null;
  const txBody = findChild(shape, 'txBody');
  const paragraphs = readParagraphs(txBody, placeholder.defaults, ctx.palette);
  const text = textFromParagraphs(paragraphs);
  const { fill, borderColor, borderWidthPt } = fillAndBorder(shapePr, ctx.palette);
  if (!text && !fill && !borderColor) return null;
  const bodyPr = findChild(txBody, 'bodyPr');
  const anchorRaw = attr(bodyPr, 'anchor') ?? placeholder.defaults?.anchor;
  const anchor = anchorRaw === 'ctr' ? 'middle' : anchorRaw === 'b' ? 'bottom' : 'top';
  const preset = attr(findChild(shapePr, 'prstGeom'), 'prst');
  const rotation = numAttr(xfrm, 'rot', 0) ?? 0;
  const element: SlideTextElement = {
    kind: 'text',
    id: uid('slide_text'),
    ...normaliseRect(rect, ctx.slideWidthEmu, ctx.slideHeightEmu),
    rotationDeg: rotation ? rotation / 60_000 : undefined,
    paragraphs,
    fill,
    borderColor,
    borderWidthPt,
    anchor,
    insetLeftPt: (numAttr(bodyPr, 'lIns', 91_440) ?? 91_440) / EMU_PER_PT,
    insetRightPt: (numAttr(bodyPr, 'rIns', 91_440) ?? 91_440) / EMU_PER_PT,
    insetTopPt: (numAttr(bodyPr, 'tIns', 45_720) ?? 45_720) / EMU_PER_PT,
    insetBottomPt: (numAttr(bodyPr, 'bIns', 45_720) ?? 45_720) / EMU_PER_PT,
    placeholderType: placeholder.type,
    preset,
  };
  return element;
}

async function parsePicture(
  picture: XNode,
  mapper: RectMapper,
  partPath: string,
  ctx: ParserContext,
): Promise<SlideElement | null> {
  const shapePr = findChild(picture, 'spPr');
  const rawRect = readRect(findChild(shapePr, 'xfrm'));
  if (!rawRect) return null;
  const rect = mapper(rawRect);
  if (rect.w <= 0 || rect.h <= 0) return null;
  const blipFill = findChild(picture, 'blipFill');
  const blip = findChild(blipFill, 'blip');
  const embed = attr(blip, 'r:embed') ?? attr(blip, 'r:link');
  const assetId = await ctx.assetForRel(partPath, embed);
  if (!assetId) return null;
  const srcRect = findChild(blipFill, 'srcRect');
  let crop: SlideImageCrop | undefined;
  if (srcRect) {
    const value = (name: string) => Math.max(0, Math.min(0.99, (numAttr(srcRect, name, 0) ?? 0) / 100_000));
    const left = value('l');
    const top = value('t');
    const right = value('r');
    const bottom = value('b');
    if (left + right < 1 && top + bottom < 1) crop = { left, top, right, bottom };
  }
  const alt = attr(findChild(findChild(picture, 'nvPicPr'), 'cNvPr'), 'descr');
  return {
    kind: 'image',
    id: uid('slide_image'),
    ...normaliseRect(rect, ctx.slideWidthEmu, ctx.slideHeightEmu),
    rotationDeg: (numAttr(findChild(shapePr, 'xfrm'), 'rot', 0) ?? 0) / 60_000 || undefined,
    assetId,
    crop,
    alt,
  };
}

async function walkShapeTree(
  shapeTree: XNode | undefined,
  mapper: RectMapper,
  partPath: string,
  ctx: ParserContext,
  layout: LayoutInfo,
): Promise<SlideElement[]> {
  if (!shapeTree) return [];
  const elements: SlideElement[] = [];
  for (const node of childNodes(shapeTree)) {
    if (node.name === 'sp') {
      const element = await parseShape(node, mapper, partPath, ctx, layout);
      if (element) elements.push(element);
    } else if (node.name === 'pic') {
      const element = await parsePicture(node, mapper, partPath, ctx);
      if (element) elements.push(element);
    } else if (node.name === 'graphicFrame') {
      const rect = readRect(findChild(node, 'xfrm'));
      const table = readTable(node, ctx.palette);
      if (table && rect) {
        const mapped = mapper(rect);
        elements.push({ ...table, ...normaliseRect(mapped, ctx.slideWidthEmu, ctx.slideHeightEmu) });
      } else {
        const graphicData = findChild(findChild(node, 'graphic'), 'graphicData');
        if (findChild(graphicData, 'chart')) {
          ctx.warn('chart_skipped', 'Biểu đồ trong slide chưa được hiển thị; chỉ nội dung chữ và bảng được mô phỏng.', 'info');
        }
      }
    } else if (node.name === 'grpSp') {
      const groupMap = groupMapper(node, mapper);
      elements.push(...(await walkShapeTree(node, groupMap, partPath, ctx, layout)));
    }
  }
  return elements;
}

/* ------------------------------------------------------------------ */
/* Presentation and slides                                             */
/* ------------------------------------------------------------------ */

interface PresentationLayoutData {
  widthEmu: number;
  heightEmu: number;
  slidePaths: string[];
}

async function readPresentationLayout(
  zip: JSZip,
  presentationRels: Map<string, Relationship>,
): Promise<PresentationLayoutData> {
  const nodes = await readXmlPart(zip, 'ppt/presentation.xml');
  const presentation = rootNode(nodes, 'presentation');
  if (!presentation) {
    throw new PresentationParseError(
      'invalid_content',
      'File không chứa ppt/presentation.xml hợp lệ. Hãy kiểm tra lại file PowerPoint.',
    );
  }
  const size = findChild(presentation, 'sldSz');
  const widthEmu = numAttr(size, 'cx', DEFAULT_SLIDE_WIDTH) ?? DEFAULT_SLIDE_WIDTH;
  const heightEmu = numAttr(size, 'cy', DEFAULT_SLIDE_HEIGHT) ?? DEFAULT_SLIDE_HEIGHT;
  const slideIdList = findChild(presentation, 'sldIdLst');
  const slidePaths: string[] = [];
  for (const slideId of findChildren(slideIdList, 'sldId')) {
    const relationshipId = attr(slideId, 'r:id');
    if (!relationshipId) continue;
    const rel = presentationRels.get(relationshipId);
    if (!rel) continue;
    slidePaths.push(resolvePartPath('ppt/presentation.xml', rel.target));
  }
  if (!slidePaths.length) {
    const discovered = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => {
        const numberA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
        const numberB = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return numberA - numberB;
      });
    slidePaths.push(...discovered);
  }
  return { widthEmu, heightEmu, slidePaths };
}

async function parseSlide(
  path: string,
  index: number,
  ctx: ParserContext,
  layoutData: PresentationLayoutData,
): Promise<PresentationSlide> {
  const nodes = await readXmlPart(ctx.zip, path);
  const slide = rootNode(nodes, 'sld');
  if (!slide) {
    throw new PresentationParseError('slide_invalid', `Không đọc được slide ${index + 1}.`);
  }
  const rels = await ctx.getRels(path);
  const layoutRel = [...rels.values()].find((rel) => rel.type.endsWith('/slideLayout'));
  const layoutPath = layoutRel ? resolvePartPath(path, layoutRel.target) : null;
  const layout: LayoutInfo = layoutPath ? await ctx.getLayout(layoutPath) : { placeholders: new Map() };
  const cSld = findChild(slide, 'cSld');
  const ownBackground = await backgroundFromShapeTree(slide, path, ctx);
  const background: SlideBackground =
    ownBackground ??
    layout.background ?? {
      color: ctx.palette.lt1,
    };
  const elements = await walkShapeTree(findChild(cSld, 'spTree'), identityMapper, path, ctx, layout);
  const textParts: string[] = [];
  for (const element of elements) {
    if (element.kind === 'text') {
      const value = textFromParagraphs(element.paragraphs);
      if (value) textParts.push(value);
    } else if (element.kind === 'table') {
      for (const row of element.rows) {
        const value = row.map((cell) => cell.text).filter(Boolean).join('\t');
        if (value) textParts.push(value);
      }
    }
  }
  const text = textParts.join('\n').slice(0, MAX_SLIDE_TEXT_CHARS);
  const titleElement =
    elements.find(
      (element) =>
        element.kind === 'text' &&
        (element.placeholderType === 'title' || element.placeholderType === 'ctrTitle') &&
        textFromParagraphs(element.paragraphs),
    ) as SlideTextElement | undefined;
  let title = titleElement ? textFromParagraphs(titleElement.paragraphs) : '';
  if (!title) {
    let best: { text: string; size: number } | null = null;
    for (const element of elements) {
      if (element.kind !== 'text') continue;
      const value = textFromParagraphs(element.paragraphs);
      if (!value || value.length > 160) continue;
      const size = Math.max(
        0,
        ...element.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => run.fontSizePt ?? 0)),
      );
      if (!best || size > best.size) best = { text: value, size };
    }
    title = best?.text ?? text.split('\n')[0] ?? '';
  }
  return {
    id: `slide_${index + 1}`,
    index,
    title: title.replace(/\s+/g, ' ').trim().slice(0, 180),
    text,
    background,
    elements,
  };
}

function reportProgress(
  options: ParsePresentationOptions,
  value: number,
  stage: string,
  message: string,
): void {
  options.onProgress?.({ value: Math.max(0, Math.min(1, value)), stage, message });
}

async function yieldToUi(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Parse a .pptx file in the browser. No network request is made and the
 * original bytes are not retained.
 */
export async function parsePptxFile(
  file: File,
  options: ParsePresentationOptions = {},
): Promise<PresentationDraft> {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pptx')) {
    throw new PresentationParseError(
      'unsupported_file',
      'Chỉ hỗ trợ file .pptx. File .ppt cũ cần được lưu lại thành .pptx trước khi tải.',
    );
  }
  if (file.size > MAX_PPTX_BYTES) {
    throw new PresentationParseError(
      'file_too_large',
      `File PPTX vượt quá ${Math.round(MAX_PPTX_BYTES / 1024 / 1024)}MB. Hãy chọn file nhỏ hơn.`,
    );
  }
  reportProgress(options, 0.03, 'reading', 'Đang đọc file PowerPoint…');
  const buffer = await file.arrayBuffer();
  return parsePptxBuffer(buffer, { ...options, fileName: file.name, fileSize: file.size });
}

export async function parsePptxBuffer(
  buffer: ArrayBuffer,
  options: ParsePresentationOptions = {},
): Promise<PresentationDraft> {
  if (!buffer || buffer.byteLength === 0) {
    throw new PresentationParseError('empty_file', 'File PPTX rỗng hoặc không đọc được.');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new PresentationParseError(
      'invalid_zip',
      'File không phải PPTX hợp lệ hoặc đã bị hỏng. Hãy mở lại bằng PowerPoint và lưu thành .pptx.',
    );
  }
  if (!zip.file('ppt/presentation.xml')) {
    throw new PresentationParseError(
      'invalid_pptx',
      'File thiếu cấu trúc PowerPoint (ppt/presentation.xml). Có thể đây không phải file .pptx thật.',
    );
  }

  reportProgress(options, 0.1, 'structure', 'Đang đọc bố cục bài trình chiếu…');
  const presentationRels = await readRelationships(zip, 'ppt/presentation.xml');
  const layoutData = await readPresentationLayout(zip, presentationRels);
  const palette = await loadThemePalette(zip, presentationRels);
  const ctx = createContext(zip, palette, layoutData.widthEmu, layoutData.heightEmu);

  if (!layoutData.slidePaths.length) {
    throw new PresentationParseError('no_slides', 'File PPTX không có slide nào để trình chiếu.');
  }

  const slides: PresentationSlide[] = [];
  for (const [index, path] of layoutData.slidePaths.entries()) {
    reportProgress(
      options,
      0.15 + (index / layoutData.slidePaths.length) * 0.75,
      'slides',
      `Đang xử lý slide ${index + 1}/${layoutData.slidePaths.length}…`,
    );
    try {
      slides.push(await parseSlide(path, index, ctx, layoutData));
    } catch (error) {
      if (error instanceof PresentationParseError) throw error;
      ctx.warn(
        'slide_skipped',
        `Không đọc được slide ${index + 1}; slide này được bỏ qua.`,
        'warning',
      );
    }
    await yieldToUi();
  }
  if (!slides.length) {
    throw new PresentationParseError(
      'slides_unreadable',
      'Không đọc được slide nào trong file. Hãy thử lưu lại file bằng PowerPoint.',
    );
  }
  if (!slides.some((slide) => slide.text.length || slide.elements.some((element) => element.kind === 'image'))) {
    ctx.warn(
      'empty_slides',
      'Các slide không có chữ hoặc ảnh đọc được. Bạn vẫn có thể trình chiếu nhưng nội dung có thể trống.',
      'info',
    );
  }
  reportProgress(options, 0.94, 'finishing', 'Đang hoàn tất dữ liệu slide…');
  const draft: PresentationDraft = {
    fileName: options.fileName ?? 'bai-trinh-chieu.pptx',
    fileSize: options.fileSize ?? buffer.byteLength,
    slideWidthEmu: layoutData.widthEmu,
    slideHeightEmu: layoutData.heightEmu,
    slides,
    assets: ctx.assets,
    warnings: ctx.warnings,
  };
  reportProgress(options, 1, 'done', `Đã đọc ${slides.length} slide.`);
  return draft;
}
