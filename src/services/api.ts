import { apiClient } from "@/services/http";
import { buildEditorSceneForSlide } from "@/services/sceneBuilders";

const DEFAULT_PRESENTATION_THEME = "editorial-light";
const DEFAULT_SCHEMA_VERSION = "2026-04";
export const DEFAULT_SCENE_VERSION = "1.0";
export const DEFAULT_SCENE_WIDTH = 1600;
export const DEFAULT_SCENE_HEIGHT = 900;
export const FIXED_BG_ELEMENT_ID = "slide-fixed-background";

export type SlideDensity = "compact" | "balanced" | "expanded";
export type SlideType =
  | "cover"
  | "agenda"
  | "section"
  | "introduction"
  | "content"
  | "synthesis"
  | "conclusion"
  | "closing"
  | "optional";

export type ContentFormat =
  | "paragraph"
  | "bullets"
  | "definition"
  | "comparison"
  | "table"
  | "timeline"
  | "mixed"
  | "quote"
  | "kpi"
  | "process"
  | "workflow";

export type SlideElementType =
  | "text"
  | "shape"
  | "list"
  | "table"
  | "media"
  | "icon"
  | "chart"
  | "columns"
  | "group"
  | "background";
export type ShapeKind = "rect" | "ellipse";
export type MediaKind = "image" | "video";
export type ChartKind = "bar" | "line";

export interface SlideElementBase {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  opacity: number;
}

export interface TextSlideElement extends SlideElementBase {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  align: "left" | "center" | "right";
  lineHeight: number;
}

export interface ShapeSlideElement extends SlideElementBase {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  label: string;
  textColor: string;
  fontSize: number;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
}

export interface ListSlideElement extends SlideElementBase {
  type: "list";
  ordered: boolean;
  items: string[];
  color: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
}

export interface TableSlideElement extends SlideElementBase {
  type: "table";
  headers: string[];
  rows: string[][];
  headerFill: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
}

export interface MediaSlideElement extends SlideElementBase {
  type: "media";
  mediaKind: MediaKind;
  src: string;
  alt: string;
  fit: "cover" | "contain";
  borderRadius: number;
  background: string;
}

export interface IconSlideElement extends SlideElementBase {
  type: "icon";
  iconName: string;
  color: string;
  background: string;
  fontSize: number;
}

export interface ChartSlideElement extends SlideElementBase {
  type: "chart";
  chartKind: ChartKind;
  labels: string[];
  values: number[];
  palette: string[];
  strokeColor: string;
}

export interface ColumnsSlideElement extends SlideElementBase {
  type: "columns";
  columns: string[][];
  gap: number;
  titleColor: string;
  textColor: string;
}

export interface GroupSlideElement extends SlideElementBase {
  type: "group";
  label: string;
  borderColor: string;
  fill: string;
}

export interface BackgroundSlideElement extends SlideElementBase {
  type: "background";
  fill: string;
  accent: string;
  pattern: "none" | "dots" | "grid";
}

export type SlideElement =
  | TextSlideElement
  | ShapeSlideElement
  | ListSlideElement
  | TableSlideElement
  | MediaSlideElement
  | IconSlideElement
  | ChartSlideElement
  | ColumnsSlideElement
  | GroupSlideElement
  | BackgroundSlideElement;

export interface EditorScene {
  version: string;
  width: number;
  height: number;
  background: string;
  elements: SlideElement[];
}

export interface Slide {
  slide_number: number;
  slide_type: SlideType;
  semantic_type: string;
  layout_variant: string;
  density: SlideDensity;
  title: string;
  purpose: string;
  content_format: ContentFormat;
  main_content: string[];
  speaker_notes: string;
  suggested_visual: string | null;
  transition_to_next: string;
  editor_scene: EditorScene;
}

export interface Presentation {
  schema_version: string;
  theme: string;
  language: string;
  presentation_title: string;
  presentation_subtitle: string;
  target_audience: string;
  presentation_goal: string;
  tone: string;
  research_used?: boolean;
  sources?: string[];
  slides: Slide[];
}

export interface PersistedPresentationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface PersistedPresentationResponse {
  id: string;
  title: string;
  content: Presentation;
  created_at: string;
  updated_at: string;
}

export interface FavoriteImageAsset {
  id: string;
  title: string;
  prompt: string;
  image_data_url: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const candidate = String(value ?? "").trim();
  return candidate || fallback;
}

export function createTextElement(
  id: string,
  text: string,
  zIndex: number,
  partial?: Partial<TextSlideElement>,
): TextSlideElement {
  return {
    id,
    type: "text",
    x: partial?.x ?? 120,
    y: partial?.y ?? 120,
    width: partial?.width ?? 640,
    height: partial?.height ?? 80,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    text: text.trim() || "Texte",
    color: partial?.color ?? "#0f172a",
    fontSize: clamp(partial?.fontSize ?? 34, 8, 220),
    fontFamily: partial?.fontFamily ?? "Geist Variable, sans-serif",
    fontWeight: clamp(partial?.fontWeight ?? 500, 100, 900),
    fontStyle: partial?.fontStyle === "italic" ? "italic" : "normal",
    align:
      partial?.align === "center" || partial?.align === "right"
        ? partial.align
        : "left",
    lineHeight: clamp(partial?.lineHeight ?? 1.25, 1, 2.5),
  };
}

export function createShapeElement(
  id: string,
  zIndex: number,
  partial?: Partial<ShapeSlideElement>,
): ShapeSlideElement {
  return {
    id,
    type: "shape",
    x: partial?.x ?? 100,
    y: partial?.y ?? 100,
    width: partial?.width ?? 280,
    height: partial?.height ?? 180,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    shape: partial?.shape === "ellipse" ? "ellipse" : "rect",
    fill: partial?.fill ?? "#ffffff",
    stroke: partial?.stroke ?? "#94a3b8",
    strokeWidth: clamp(partial?.strokeWidth ?? 1.5, 0, 24),
    cornerRadius: clamp(partial?.cornerRadius ?? 8, 0, 400),
    label: String(partial?.label ?? ""),
    textColor: partial?.textColor ?? "#0f172a",
    fontSize: clamp(toNumber(partial?.fontSize, 28), 8, 220),
    fontWeight: clamp(toNumber(partial?.fontWeight, 600), 100, 900),
    textAlign:
      partial?.textAlign === "left" || partial?.textAlign === "right"
        ? partial.textAlign
        : "center",
  };
}

export function createListElement(
  id: string,
  zIndex: number,
  partial?: Partial<ListSlideElement>,
): ListSlideElement {
  return {
    id,
    type: "list",
    x: partial?.x ?? 160,
    y: partial?.y ?? 300,
    width: partial?.width ?? 980,
    height: partial?.height ?? 260,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    ordered: Boolean(partial?.ordered),
    items:
      Array.isArray(partial?.items) && partial.items.length > 0
        ? partial.items.map((item) => String(item ?? "")).filter(Boolean)
        : ["Premier point", "Deuxieme point", "Troisieme point"],
    color: partial?.color ?? "#1e293b",
    fontSize: clamp(toNumber(partial?.fontSize, 30), 8, 180),
    fontFamily: partial?.fontFamily ?? "Geist Variable, sans-serif",
    fontWeight: clamp(toNumber(partial?.fontWeight, 500), 100, 900),
    lineHeight: clamp(toNumber(partial?.lineHeight, 1.3), 1, 2.6),
  };
}

export function createTableElement(
  id: string,
  zIndex: number,
  partial?: Partial<TableSlideElement>,
): TableSlideElement {
  const headers =
    Array.isArray(partial?.headers) && partial.headers.length > 0
      ? partial.headers.map((item) => String(item ?? "")).slice(0, 8)
      : ["Colonne A", "Colonne B", "Colonne C"];
  const rows =
    Array.isArray(partial?.rows) && partial.rows.length > 0
      ? partial.rows
          .slice(0, 8)
          .map((row) =>
            Array.isArray(row)
              ? row.map((cell) => String(cell ?? "")).slice(0, headers.length)
              : [],
          )
      : [
          ["Ligne 1", "Valeur", "Observation"],
          ["Ligne 2", "Valeur", "Observation"],
        ];

  return {
    id,
    type: "table",
    x: partial?.x ?? 140,
    y: partial?.y ?? 250,
    width: partial?.width ?? 1200,
    height: partial?.height ?? 430,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    headers,
    rows,
    headerFill: partial?.headerFill ?? "#e2e8f0",
    borderColor: partial?.borderColor ?? "#94a3b8",
    textColor: partial?.textColor ?? "#0f172a",
    fontSize: clamp(toNumber(partial?.fontSize, 22), 8, 120),
  };
}

export function createMediaElement(
  id: string,
  zIndex: number,
  partial?: Partial<MediaSlideElement>,
): MediaSlideElement {
  return {
    id,
    type: "media",
    x: partial?.x ?? 220,
    y: partial?.y ?? 220,
    width: partial?.width ?? 680,
    height: partial?.height ?? 380,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    mediaKind: partial?.mediaKind === "video" ? "video" : "image",
    src: String(partial?.src ?? "").trim(),
    alt: String(partial?.alt ?? "Media"),
    fit: partial?.fit === "contain" ? "contain" : "cover",
    borderRadius: clamp(toNumber(partial?.borderRadius, 24), 0, 160),
    background: partial?.background ?? "#e2e8f0",
  };
}

export function createIconElement(
  id: string,
  zIndex: number,
  partial?: Partial<IconSlideElement>,
): IconSlideElement {
  return {
    id,
    type: "icon",
    x: partial?.x ?? 180,
    y: partial?.y ?? 180,
    width: partial?.width ?? 96,
    height: partial?.height ?? 96,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    iconName: String(partial?.iconName ?? "sparkles"),
    color: partial?.color ?? "#0f172a",
    background: partial?.background ?? "#f1f5f9",
    fontSize: clamp(toNumber(partial?.fontSize, 44), 12, 220),
  };
}

export function createChartElement(
  id: string,
  zIndex: number,
  partial?: Partial<ChartSlideElement>,
): ChartSlideElement {
  const labels =
    Array.isArray(partial?.labels) && partial.labels.length > 0
      ? partial.labels.map((item) => String(item ?? "")).slice(0, 8)
      : ["Q1", "Q2", "Q3", "Q4"];
  const values =
    Array.isArray(partial?.values) && partial.values.length > 0
      ? partial.values.slice(0, labels.length).map((item) => toNumber(item, 0))
      : [42, 58, 64, 79];

  return {
    id,
    type: "chart",
    x: partial?.x ?? 180,
    y: partial?.y ?? 240,
    width: partial?.width ?? 980,
    height: partial?.height ?? 420,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    chartKind: partial?.chartKind === "line" ? "line" : "bar",
    labels,
    values,
    palette:
      Array.isArray(partial?.palette) && partial.palette.length > 0
        ? partial.palette.map((item) => String(item ?? "")).slice(0, 8)
        : ["#0f766e", "#0ea5e9", "#f59e0b", "#f97316"],
    strokeColor: partial?.strokeColor ?? "#0f172a",
  };
}

export function createColumnsElement(
  id: string,
  zIndex: number,
  partial?: Partial<ColumnsSlideElement>,
): ColumnsSlideElement {
  const columnsRaw = Array.isArray(partial?.columns) ? partial.columns : [];
  const columns =
    columnsRaw.length > 0
      ? columnsRaw
          .slice(0, 4)
          .map((column) =>
            Array.isArray(column)
              ? column.map((item) => String(item ?? "")).filter(Boolean)
              : [],
          )
      : [
          ["Colonne 1", "Point A", "Point B"],
          ["Colonne 2", "Point A", "Point B"],
        ];

  return {
    id,
    type: "columns",
    x: partial?.x ?? 140,
    y: partial?.y ?? 260,
    width: partial?.width ?? 1220,
    height: partial?.height ?? 360,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    columns,
    gap: clamp(toNumber(partial?.gap, 26), 8, 120),
    titleColor: partial?.titleColor ?? "#0f172a",
    textColor: partial?.textColor ?? "#334155",
  };
}

export function createGroupElement(
  id: string,
  zIndex: number,
  partial?: Partial<GroupSlideElement>,
): GroupSlideElement {
  return {
    id,
    type: "group",
    x: partial?.x ?? 120,
    y: partial?.y ?? 120,
    width: partial?.width ?? 720,
    height: partial?.height ?? 440,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: Boolean(partial?.locked),
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    label: String(partial?.label ?? "Groupe"),
    borderColor: partial?.borderColor ?? "#94a3b8",
    fill: partial?.fill ?? "rgba(248,250,252,0.7)",
  };
}

export function createBackgroundElement(
  id: string,
  zIndex: number,
  partial?: Partial<BackgroundSlideElement>,
): BackgroundSlideElement {
  return {
    id,
    type: "background",
    x: partial?.x ?? 0,
    y: partial?.y ?? 0,
    width: partial?.width ?? DEFAULT_SCENE_WIDTH,
    height: partial?.height ?? DEFAULT_SCENE_HEIGHT,
    rotation: partial?.rotation ?? 0,
    zIndex,
    locked: partial?.locked ?? true,
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
    fill: partial?.fill ?? "#ffffff",
    accent: partial?.accent ?? "#e2e8f0",
    pattern:
      partial?.pattern === "dots" || partial?.pattern === "grid"
        ? partial.pattern
        : "none",
  };
}

function isFixedBackgroundShape(element: SlideElement): boolean {
  return element.type === "shape" && element.id === FIXED_BG_ELEMENT_ID;
}

function createFixedBackgroundShape(
  width: number,
  height: number,
  partial?: Partial<ShapeSlideElement>,
): ShapeSlideElement {
  return createShapeElement(FIXED_BG_ELEMENT_ID, 0, {
    ...partial,
    id: FIXED_BG_ELEMENT_ID,
    x: 0,
    y: 0,
    width: Math.max(640, width),
    height: Math.max(360, height),
    locked: true,
    fill: partial?.fill ?? "#ffffff",
    stroke: "transparent",
    strokeWidth: 0,
    cornerRadius: 0,
    label: partial?.label ?? "",
    visible: partial?.visible ?? true,
    opacity: clamp(partial?.opacity ?? 1, 0.05, 1),
  });
}

function looksLikeBackgroundShape(
  element: SlideElement,
  sceneWidth: number,
  sceneHeight: number,
): element is ShapeSlideElement {
  return (
    element.type === "shape" &&
    element.width >= sceneWidth * 0.95 &&
    element.height >= sceneHeight * 0.95 &&
    element.x <= 5 &&
    element.y <= 5
  );
}

export function ensureFixedBackgroundShape(scene: EditorScene): EditorScene {
  const width = clamp(toNumber(scene.width, DEFAULT_SCENE_WIDTH), 640, 4000);
  const height = clamp(toNumber(scene.height, DEFAULT_SCENE_HEIGHT), 360, 3000);

  const explicitFixed = scene.elements.find(isFixedBackgroundShape);
  const inferredBackground = explicitFixed
    ? null
    : scene.elements.find((element) =>
        looksLikeBackgroundShape(element, width, height),
      );

  const seedBackground =
    (explicitFixed as ShapeSlideElement | undefined) ??
    (inferredBackground as ShapeSlideElement | undefined);

  const base = createFixedBackgroundShape(width, height, seedBackground);

  const elements = [
    base,
    ...scene.elements.filter(
      (element) =>
        element.id !== base.id &&
        (!inferredBackground || element.id !== inferredBackground.id),
    ),
  ]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item, index) => ({ ...item, zIndex: index }));

  return {
    ...scene,
    width,
    height,
    background: "#ffffff",
    elements,
  };
}

function createDefaultEditorSceneFromSlide(
  slide: Pick<Slide, "title" | "purpose" | "main_content">,
  index: number,
): EditorScene {
  const title = String(slide.title ?? "").trim() || `Slide ${index + 1}`;
  const purpose = String(slide.purpose ?? "").trim();
  const contentItems = Array.isArray(slide.main_content)
    ? slide.main_content
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const elements: SlideElement[] = [
    createTextElement(`title-${index}`, title, 0, {
      x: 120,
      y: 98,
      width: 1320,
      height: 110,
      fontSize: 56,
      fontWeight: 800,
      color: "#0f766e",
    }),
  ];

  if (purpose) {
    elements.push(
      createTextElement(`purpose-${index}`, purpose, 1, {
        x: 120,
        y: 214,
        width: 1200,
        height: 90,
        fontSize: 30,
        fontWeight: 500,
        color: "#475569",
      }),
    );
  }

  contentItems.forEach((item, itemIndex) => {
    elements.push(
      createTextElement(`content-${index}-${itemIndex}`, item, 2 + itemIndex, {
        x: 152,
        y: 344 + itemIndex * 76,
        width: 1240,
        height: 70,
        fontSize: 34,
        fontWeight: 500,
        color: "#1e293b",
      }),
    );
  });

  return ensureFixedBackgroundShape({
    version: DEFAULT_SCENE_VERSION,
    width: DEFAULT_SCENE_WIDTH,
    height: DEFAULT_SCENE_HEIGHT,
    background: "#ffffff",
    elements,
  });
}

function toBuilderSlide(slide: Partial<Slide>, index: number): Slide {
  const title = String(slide.title ?? "").trim() || `Slide ${index + 1}`;
  const purpose = String(slide.purpose ?? "").trim();
  const mainContent = Array.isArray(slide.main_content)
    ? slide.main_content
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

  return {
    slide_number:
      Number.isInteger(slide.slide_number) && (slide.slide_number ?? 0) > 0
        ? (slide.slide_number as number)
        : index + 1,
    slide_type: (slide.slide_type as SlideType) ?? "content",
    semantic_type:
      String(slide.semantic_type ?? "").trim() || "content.paragraph",
    layout_variant:
      String(slide.layout_variant ?? "").trim() || "text-left-accent",
    density: (slide.density as SlideDensity) ?? "balanced",
    title,
    purpose,
    content_format: (slide.content_format as ContentFormat) ?? "paragraph",
    main_content: mainContent.length > 0 ? mainContent : [purpose || "Content"],
    speaker_notes: String(slide.speaker_notes ?? "").trim(),
    suggested_visual:
      slide.suggested_visual === null || slide.suggested_visual === undefined
        ? null
        : String(slide.suggested_visual).trim() || null,
    transition_to_next: String(slide.transition_to_next ?? "").trim(),
    editor_scene: {
      version: DEFAULT_SCENE_VERSION,
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      background: "#ffffff",
      elements: [],
    },
  };
}

export function createEditorSceneFromSlide(
  slide: Slide,
  index: number,
): EditorScene {
  try {
    return ensureFixedBackgroundShape(buildEditorSceneForSlide(slide, index));
  } catch {
    return createDefaultEditorSceneFromSlide(slide, index);
  }
}

function normalizeEditorScene(
  raw: unknown,
  slide: Partial<Slide>,
  index: number,
): EditorScene {
  if (!raw || typeof raw !== "object") {
    return createEditorSceneFromSlide(toBuilderSlide(slide, index), index);
  }

  const candidate = raw as Partial<EditorScene>;
  const elementsRaw = Array.isArray(candidate.elements)
    ? candidate.elements
    : [];
  if (elementsRaw.length === 0) {
    return createEditorSceneFromSlide(toBuilderSlide(slide, index), index);
  }

  const normalizedElements = elementsRaw
    .map((item, elementIndex) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawElement = item as Partial<SlideElement>;
      if (rawElement.type === "shape") {
        const shape = rawElement as Partial<ShapeSlideElement>;
        return createShapeElement(
          normalizeId(shape.id, `shape-${index}-${elementIndex}`),
          elementIndex,
          {
            ...shape,
            x: toNumber(shape.x, 100),
            y: toNumber(shape.y, 100),
            width: clamp(toNumber(shape.width, 280), 16, 2000),
            height: clamp(toNumber(shape.height, 180), 16, 2000),
            rotation: toNumber(shape.rotation, 0),
            zIndex: toNumber(shape.zIndex, elementIndex),
            opacity: clamp(toNumber(shape.opacity, 1), 0.05, 1),
            strokeWidth: clamp(toNumber(shape.strokeWidth, 2), 0, 24),
            cornerRadius: clamp(toNumber(shape.cornerRadius, 8), 0, 400),
            fontSize: clamp(toNumber(shape.fontSize, 28), 8, 220),
            fontWeight: clamp(toNumber(shape.fontWeight, 600), 100, 900),
          },
        );
      }

      if (rawElement.type === "list") {
        const list = rawElement as Partial<ListSlideElement>;
        return createListElement(
          normalizeId(list.id, `list-${index}-${elementIndex}`),
          elementIndex,
          {
            ...list,
            x: toNumber(list.x, 160),
            y: toNumber(list.y, 280),
            width: clamp(toNumber(list.width, 980), 24, 2200),
            height: clamp(toNumber(list.height, 260), 24, 2200),
            rotation: toNumber(list.rotation, 0),
            zIndex: toNumber(list.zIndex, elementIndex),
            opacity: clamp(toNumber(list.opacity, 1), 0.05, 1),
            fontSize: clamp(toNumber(list.fontSize, 30), 8, 180),
            fontWeight: clamp(toNumber(list.fontWeight, 500), 100, 900),
            lineHeight: clamp(toNumber(list.lineHeight, 1.3), 1, 2.6),
          },
        );
      }

      if (rawElement.type === "table") {
        const table = rawElement as Partial<TableSlideElement>;
        return createTableElement(
          normalizeId(table.id, `table-${index}-${elementIndex}`),
          elementIndex,
          {
            ...table,
            x: toNumber(table.x, 140),
            y: toNumber(table.y, 250),
            width: clamp(toNumber(table.width, 1200), 160, 2200),
            height: clamp(toNumber(table.height, 430), 120, 2200),
            rotation: toNumber(table.rotation, 0),
            zIndex: toNumber(table.zIndex, elementIndex),
            opacity: clamp(toNumber(table.opacity, 1), 0.05, 1),
            fontSize: clamp(toNumber(table.fontSize, 22), 8, 120),
          },
        );
      }

      if (rawElement.type === "media") {
        const media = rawElement as Partial<MediaSlideElement>;
        return createMediaElement(
          normalizeId(media.id, `media-${index}-${elementIndex}`),
          elementIndex,
          {
            ...media,
            x: toNumber(media.x, 220),
            y: toNumber(media.y, 220),
            width: clamp(toNumber(media.width, 680), 48, 2600),
            height: clamp(toNumber(media.height, 380), 48, 2000),
            rotation: toNumber(media.rotation, 0),
            zIndex: toNumber(media.zIndex, elementIndex),
            opacity: clamp(toNumber(media.opacity, 1), 0.05, 1),
            borderRadius: clamp(toNumber(media.borderRadius, 24), 0, 160),
          },
        );
      }

      if (rawElement.type === "icon") {
        const icon = rawElement as Partial<IconSlideElement>;
        return createIconElement(
          normalizeId(icon.id, `icon-${index}-${elementIndex}`),
          elementIndex,
          {
            ...icon,
            x: toNumber(icon.x, 180),
            y: toNumber(icon.y, 180),
            width: clamp(toNumber(icon.width, 96), 16, 420),
            height: clamp(toNumber(icon.height, 96), 16, 420),
            rotation: toNumber(icon.rotation, 0),
            zIndex: toNumber(icon.zIndex, elementIndex),
            opacity: clamp(toNumber(icon.opacity, 1), 0.05, 1),
            fontSize: clamp(toNumber(icon.fontSize, 44), 12, 220),
          },
        );
      }

      if (rawElement.type === "chart") {
        const chart = rawElement as Partial<ChartSlideElement>;
        return createChartElement(
          normalizeId(chart.id, `chart-${index}-${elementIndex}`),
          elementIndex,
          {
            ...chart,
            x: toNumber(chart.x, 180),
            y: toNumber(chart.y, 240),
            width: clamp(toNumber(chart.width, 980), 120, 2400),
            height: clamp(toNumber(chart.height, 420), 120, 2000),
            rotation: toNumber(chart.rotation, 0),
            zIndex: toNumber(chart.zIndex, elementIndex),
            opacity: clamp(toNumber(chart.opacity, 1), 0.05, 1),
          },
        );
      }

      if (rawElement.type === "columns") {
        const columns = rawElement as Partial<ColumnsSlideElement>;
        return createColumnsElement(
          normalizeId(columns.id, `columns-${index}-${elementIndex}`),
          elementIndex,
          {
            ...columns,
            x: toNumber(columns.x, 140),
            y: toNumber(columns.y, 260),
            width: clamp(toNumber(columns.width, 1220), 120, 2600),
            height: clamp(toNumber(columns.height, 360), 120, 1800),
            rotation: toNumber(columns.rotation, 0),
            zIndex: toNumber(columns.zIndex, elementIndex),
            opacity: clamp(toNumber(columns.opacity, 1), 0.05, 1),
            gap: clamp(toNumber(columns.gap, 26), 8, 120),
          },
        );
      }

      if (rawElement.type === "group") {
        const group = rawElement as Partial<GroupSlideElement>;
        return createGroupElement(
          normalizeId(group.id, `group-${index}-${elementIndex}`),
          elementIndex,
          {
            ...group,
            x: toNumber(group.x, 120),
            y: toNumber(group.y, 120),
            width: clamp(toNumber(group.width, 720), 32, 2600),
            height: clamp(toNumber(group.height, 440), 32, 2000),
            rotation: toNumber(group.rotation, 0),
            zIndex: toNumber(group.zIndex, elementIndex),
            opacity: clamp(toNumber(group.opacity, 1), 0.05, 1),
          },
        );
      }

      if (rawElement.type === "background") {
        const background = rawElement as Partial<BackgroundSlideElement>;
        return createBackgroundElement(
          normalizeId(background.id, `background-${index}-${elementIndex}`),
          elementIndex,
          {
            ...background,
            x: toNumber(background.x, 0),
            y: toNumber(background.y, 0),
            width: clamp(
              toNumber(background.width, DEFAULT_SCENE_WIDTH),
              640,
              4000,
            ),
            height: clamp(
              toNumber(background.height, DEFAULT_SCENE_HEIGHT),
              360,
              3000,
            ),
            rotation: toNumber(background.rotation, 0),
            zIndex: toNumber(background.zIndex, elementIndex),
            opacity: clamp(toNumber(background.opacity, 1), 0.05, 1),
          },
        );
      }

      const text = rawElement as Partial<TextSlideElement>;
      return createTextElement(
        normalizeId(text.id, `text-${index}-${elementIndex}`),
        String(text.text ?? "Texte"),
        elementIndex,
        {
          ...text,
          x: toNumber(text.x, 120),
          y: toNumber(text.y, 120),
          width: clamp(toNumber(text.width, 620), 24, 2000),
          height: clamp(toNumber(text.height, 80), 24, 2000),
          rotation: toNumber(text.rotation, 0),
          zIndex: toNumber(text.zIndex, elementIndex),
          opacity: clamp(toNumber(text.opacity, 1), 0.05, 1),
          fontSize: clamp(toNumber(text.fontSize, 34), 8, 220),
          fontWeight: clamp(toNumber(text.fontWeight, 500), 100, 900),
          lineHeight: clamp(toNumber(text.lineHeight, 1.25), 1, 2.5),
        },
      );
    })
    .filter((item): item is SlideElement => Boolean(item))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item, elementIndex) => ({ ...item, zIndex: elementIndex }));

  if (normalizedElements.length === 0) {
    return createEditorSceneFromSlide(toBuilderSlide(slide, index), index);
  }

  return ensureFixedBackgroundShape({
    version: String(candidate.version ?? DEFAULT_SCENE_VERSION),
    width: clamp(toNumber(candidate.width, DEFAULT_SCENE_WIDTH), 640, 4000),
    height: clamp(toNumber(candidate.height, DEFAULT_SCENE_HEIGHT), 360, 3000),
    background: String(candidate.background ?? "#ffffff"),
    elements: normalizedElements,
  });
}

/**
 * Normalise une slide brute pour stabiliser le rendu frontend.
 * @param slide Donnees brutes d'une slide provenant de l'API.
 * @param index Position de la slide dans le deck.
 * @returns Une slide conforme au contrat attendu par l'UI.
 * Securite:
 * - Filtre les valeurs non typées pour eviter les etats UI invalides.
 */
function normalizeSlide(slide: Partial<Slide>, index: number): Slide {
  const content = Array.isArray(slide.main_content)
    ? slide.main_content
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

  return {
    slide_number:
      Number.isInteger(slide.slide_number) && (slide.slide_number ?? 0) > 0
        ? (slide.slide_number as number)
        : index + 1,
    slide_type: (slide.slide_type as SlideType) ?? "content",
    semantic_type:
      String(slide.semantic_type ?? "").trim() || "content.paragraph",
    layout_variant:
      String(slide.layout_variant ?? "").trim() || "text-left-accent",
    density: (slide.density as SlideDensity) ?? "balanced",
    title: String(slide.title ?? "").trim() || `Slide ${index + 1}`,
    purpose: String(slide.purpose ?? "").trim(),
    content_format: (slide.content_format as ContentFormat) ?? "paragraph",
    main_content:
      content.length > 0
        ? content
        : [String(slide.purpose ?? "").trim() || "Content"],
    speaker_notes: String(slide.speaker_notes ?? "").trim(),
    suggested_visual:
      slide.suggested_visual === null || slide.suggested_visual === undefined
        ? null
        : String(slide.suggested_visual).trim() || null,
    transition_to_next: String(slide.transition_to_next ?? "").trim(),
    editor_scene: normalizeEditorScene(slide.editor_scene, slide, index),
  };
}

/**
 * Normalise la presentation brute retournee par l'API.
 * @param payload Donnees brutes potentiellement partielles.
 * @returns Une presentation fiable et complete pour le frontend.
 * Securite:
 * - Applique des valeurs de secours pour eviter les erreurs runtime.
 */
function normalizePresentation(payload: Partial<Presentation>): Presentation {
  const rawSlides = Array.isArray(payload.slides) ? payload.slides : [];

  return {
    schema_version:
      String(payload.schema_version ?? "").trim() || DEFAULT_SCHEMA_VERSION,
    theme: String(payload.theme ?? "").trim() || DEFAULT_PRESENTATION_THEME,
    language: String(payload.language ?? "").trim() || "English",
    presentation_title:
      String(payload.presentation_title ?? "").trim() ||
      "Generated presentation",
    presentation_subtitle: String(payload.presentation_subtitle ?? "").trim(),
    target_audience: String(payload.target_audience ?? "").trim() || "General",
    presentation_goal:
      String(payload.presentation_goal ?? "").trim() || "inform",
    tone: String(payload.tone ?? "").trim() || "professional",
    research_used: Boolean(payload.research_used),
    sources: Array.isArray(payload.sources)
      ? payload.sources.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    slides: rawSlides.map((slide, index) => normalizeSlide(slide, index)),
  };
}

/**
 * Genere une presentation a partir du sujet et de la langue cible.
 * @param topic Sujet principal a presenter.
 * @param language Langue cible optionnelle.
 * @returns Une presentation normalisee prete pour le rendu.
 * Securite:
 * - La reponse distante est normalisee avant usage UI.
 */
export async function generatePresentation(
  topic: string,
  language?: string,
): Promise<Presentation> {
  const res = await apiClient.post<Presentation>("/presentations/generate", {
    topic,
    language: language || undefined,
  });
  return normalizePresentation(res.data);
}

export async function generateImageFromPrompt(
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024",
): Promise<{ image_data_url: string; mime_type: string }> {
  const res = await apiClient.post<{
    image_data_url: string;
    mime_type: string;
  }>("/presentations/generate-image", {
    prompt,
    size,
  });
  return res.data;
}

export async function listSavedPresentations(): Promise<
  PersistedPresentationSummary[]
> {
  const res =
    await apiClient.get<PersistedPresentationSummary[]>("/presentations");
  return res.data;
}

export async function createSavedPresentation(
  title: string,
  presentation: Presentation,
): Promise<{ id: string; presentation: Presentation }> {
  const res = await apiClient.post<PersistedPresentationResponse>(
    "/presentations",
    {
      title,
      content: presentation,
    },
  );
  return {
    id: res.data.id,
    presentation: normalizePresentation(res.data.content),
  };
}

export async function getSavedPresentation(
  id: string,
): Promise<{ id: string; presentation: Presentation }> {
  const res = await apiClient.get<PersistedPresentationResponse>(
    `/presentations/${id}`,
  );
  return {
    id: res.data.id,
    presentation: normalizePresentation(res.data.content),
  };
}

export async function updateSavedPresentation(
  id: string,
  title: string,
  presentation: Presentation,
): Promise<{ id: string; presentation: Presentation }> {
  const res = await apiClient.put<PersistedPresentationResponse>(
    `/presentations/${id}`,
    {
      title,
      content: presentation,
    },
  );
  return {
    id: res.data.id,
    presentation: normalizePresentation(res.data.content),
  };
}

export async function listFavoriteImageAssets(): Promise<FavoriteImageAsset[]> {
  const res = await apiClient.get<FavoriteImageAsset[]>(
    "/presentations/uploads",
  );
  return res.data;
}

export async function saveFavoriteImageAsset(payload: {
  title?: string;
  prompt?: string;
  image_data_url: string;
  mime_type?: string;
}): Promise<FavoriteImageAsset> {
  const res = await apiClient.post<FavoriteImageAsset>(
    "/presentations/uploads",
    payload,
  );
  return res.data;
}

export async function deleteFavoriteImageAsset(assetId: string): Promise<void> {
  await apiClient.delete(`/presentations/uploads/${assetId}`);
}
