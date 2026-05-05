import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { RotateCw } from "lucide-react";

import {
  collectGuides,
  snapPosition,
  type SnapGuide,
  type SpacingMarker,
} from "@/editor/layoutEngine";
import { FIXED_BG_ELEMENT_ID } from "@/services/api";
import type { EditorScene, SlideElement } from "@/services/api";
import { useElementSize } from "@/presentation/useElementSize";

const HANDLE_PX = 9;
const BORDER_PX = 1.5;
const ROTATE_HANDLE_PX = 10;
const MIN_SIZE = 20;
const INTERACTION_BORDER_COLOR = "rgba(245,158,11,0.96)";

interface DragInfo {
  ids: string[];
  sx: number;
  sy: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  entries: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    node: HTMLDivElement;
  }>;
  moved: boolean;
  guides: ReturnType<typeof collectGuides>;
}

type Corner = "nw" | "ne" | "sw" | "se";
type ResizeHandle = Corner | "w" | "e";

interface ResizeInfo {
  id: string;
  corner: ResizeHandle;
  text: boolean;
  shapeElement: boolean;
  baseShapeFontSize: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
  node: HTMLElement;
}

interface RotateInfo {
  id: string;
  cx: number;
  cy: number;
  node: HTMLElement;
}

interface SlideEditorCanvasProps {
  scene: EditorScene;
  selectedIds: string[];
  viewportZoom?: number;
  onSelectionChange: (ids: string[]) => void;
  onChangeElementGeometry: (
    id: string,
    patch: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    },
  ) => void;
  onChangeElementStyle?: (
    id: string,
    patch: {
      fontSize?: number;
    },
  ) => void;
  onUpdateTextContent?: (id: string, text: string) => void;
}

function iconFor(name: string): string {
  const key = name.toLowerCase();
  if (key.includes("check")) return "✓";
  if (key.includes("alert") || key.includes("warning")) return "!";
  if (key.includes("rocket")) return "🚀";
  if (key.includes("idea") || key.includes("light")) return "💡";
  return "✦";
}

export function SlideEditorCanvas({
  scene,
  selectedIds,
  viewportZoom = 1,
  onSelectionChange,
  onChangeElementGeometry,
  onChangeElementStyle,
  onUpdateTextContent,
}: SlideEditorCanvasProps) {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const sceneRef = useRef<HTMLDivElement>(null);
  const nodeMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [spacingMarkers, setSpacingMarkers] = useState<SpacingMarker[]>([]);

  const isFixedBackgroundElement = useCallback(
    (element: SlideElement) =>
      element.type === "shape" && element.id === FIXED_BG_ELEMENT_ID,
    [],
  );

  const W = scene.width > 0 ? scene.width : 1600;
  const H = scene.height > 0 ? scene.height : 900;

  const scale = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return 1;
    return Math.min(size.width / W, size.height / H);
  }, [size.width, size.height, W, H]);

  const stageW = W * scale;
  const stageH = H * scale;

  const elements = useMemo(
    () =>
      scene.elements
        .filter((element) => element.visible)
        .sort((a, b) => a.zIndex - b.zIndex),
    [scene.elements],
  );

  const toScene = useCallback(
    (cx: number, cy: number) => {
      const node = sceneRef.current;
      if (!node) return { x: 0, y: 0 };
      const r = node.getBoundingClientRect();
      return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    },
    [scale],
  );

  const dragR = useRef<DragInfo | null>(null);
  const resizeR = useRef<ResizeInfo | null>(null);
  const rotateR = useRef<RotateInfo | null>(null);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const { x, y } = toScene(event.clientX, event.clientY);

      if (dragR.current) {
        const d = dragR.current;
        const dx = x - d.sx;
        const dy = y - d.sy;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;

        const snapped = snapPosition(
          d.boxX + dx,
          d.boxY + dy,
          d.boxWidth,
          d.boxHeight,
          d.guides,
        );
        const deltaX = snapped.x - d.boxX;
        const deltaY = snapped.y - d.boxY;

        d.entries.forEach((entry) => {
          entry.node.style.left = `${entry.x + deltaX}px`;
          entry.node.style.top = `${entry.y + deltaY}px`;
        });

        setActiveGuides(snapped.guides);
        setSpacingMarkers(snapped.spacingMarkers);
        return;
      }

      if (resizeR.current) {
        const r = resizeR.current;
        const dx = x - r.sx;
        const dy = y - r.sy;
        let nx = r.ox;
        let ny = r.oy;
        let nw = r.ow;
        let nh = r.oh;

        if (r.text) {
          if (r.corner === "se" || r.corner === "ne" || r.corner === "e") {
            nw = Math.max(MIN_SIZE, r.ow + dx);
          } else {
            nw = Math.max(MIN_SIZE, r.ow - dx);
            nx = r.ox + r.ow - nw;
          }
          r.node.style.left = `${nx}px`;
          r.node.style.maxWidth = `${nw}px`;
          r.node.style.width = "max-content";
        } else {
          const east = r.corner === "se" || r.corner === "ne";
          const south = r.corner === "se" || r.corner === "sw";
          nw = Math.max(MIN_SIZE, east ? r.ow + dx : r.ow - dx);
          nh = Math.max(MIN_SIZE, south ? r.oh + dy : r.oh - dy);
          if (!east) nx = r.ox + r.ow - nw;
          if (!south) ny = r.oy + r.oh - nh;
          r.node.style.left = `${nx}px`;
          r.node.style.top = `${ny}px`;
          r.node.style.width = `${nw}px`;
          r.node.style.height = `${nh}px`;
        }
        setActiveGuides([]);
        setSpacingMarkers([]);
        return;
      }

      if (rotateR.current) {
        const rt = rotateR.current;
        let a = Math.atan2(x - rt.cx, -(y - rt.cy)) * (180 / Math.PI);
        if (event.shiftKey) a = Math.round(a / 15) * 15;
        rt.node.style.transform = `rotate(${a}deg)`;
        setActiveGuides([]);
        setSpacingMarkers([]);
      }
    };

    const onUp = () => {
      if (dragR.current) {
        const d = dragR.current;
        if (d.moved) {
          d.entries.forEach((entry) => {
            onChangeElementGeometry(entry.id, {
              x: parseFloat(entry.node.style.left),
              y: parseFloat(entry.node.style.top),
            });
          });
        }
        dragR.current = null;
        setActiveGuides([]);
        setSpacingMarkers([]);
        return;
      }

      if (resizeR.current) {
        const r = resizeR.current;
        const patch: Record<string, number> = {
          x: parseFloat(r.node.style.left),
          width: r.text
            ? parseFloat(r.node.style.maxWidth || `${r.node.offsetWidth}`)
            : parseFloat(r.node.style.width),
        };

        if (r.text) {
          patch.height = r.node.offsetHeight;
        } else {
          patch.y = parseFloat(r.node.style.top);
          patch.height = parseFloat(r.node.style.height);

          if (r.shapeElement && r.baseShapeFontSize > 0) {
            const scaleX = patch.width / Math.max(1, r.ow);
            const scaleY = patch.height / Math.max(1, r.oh);
            const ratio = Math.max(0.25, Math.min(scaleX, scaleY));
            const nextFontSize = Math.max(
              8,
              Math.min(220, r.baseShapeFontSize * ratio),
            );
            onChangeElementStyle?.(r.id, { fontSize: nextFontSize });
          }
        }

        onChangeElementGeometry(r.id, patch);
        resizeR.current = null;
        setActiveGuides([]);
        setSpacingMarkers([]);
        return;
      }

      if (rotateR.current) {
        const rt = rotateR.current;
        const m = rt.node.style.transform.match(/rotate\(([^)]+)deg\)/);
        const angle = m ? parseFloat(m[1]) : 0;
        onChangeElementGeometry(rt.id, { rotation: angle });
        rotateR.current = null;
        setActiveGuides([]);
        setSpacingMarkers([]);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [toScene, onChangeElementGeometry, onChangeElementStyle]);

  const effectiveZoom = Math.max(0.1, viewportZoom);
  const zoomCompensation = Math.max(0.0001, scale * effectiveZoom);
  const hs = HANDLE_PX / zoomCompensation;
  const hb = 1.5 / zoomCompensation;
  const bw = BORDER_PX / zoomCompensation;
  const rh = ROTATE_HANDLE_PX / zoomCompensation;

  const renderElementContent = (el: SlideElement, editing: boolean) => {
    if (el.type === "text") {
      if (!editing) return el.text;

      return (
        <div
          contentEditable
          suppressContentEditableWarning
          autoFocus
          style={{
            width: "100%",
            minHeight: "1em",
            color: "inherit",
            fontSize: "inherit",
            fontFamily: "inherit",
            fontWeight: "inherit",
            fontStyle: "inherit",
            textAlign: "inherit",
            lineHeight: "inherit",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            outline: "none",
            border: "none",
            background: "rgba(255,255,255,0.92)",
          }}
          onFocus={(e) => {
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          onBlur={(e) => {
            const value = e.currentTarget.innerText;
            if (value !== el.text) onUpdateTextContent?.(el.id, value);
            setEditingId(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              setEditingId(null);
            }
          }}
        >
          {el.text}
        </div>
      );
    }

    if (el.type === "shape") {
      if (editing) {
        return (
          <div
            contentEditable
            suppressContentEditableWarning
            autoFocus
            style={{
              width: "100%",
              minHeight: "1em",
              color: el.textColor,
              fontSize: el.fontSize,
              fontWeight: el.fontWeight,
              textAlign: el.textAlign,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              outline: "none",
              background: "rgba(255,255,255,0.32)",
              borderRadius: 8,
              padding: "6px 8px",
            }}
            onFocus={(e) => {
              const range = document.createRange();
              range.selectNodeContents(e.currentTarget);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }}
            onBlur={(e) => {
              const value = e.currentTarget.innerText;
              if (value !== el.label) onUpdateTextContent?.(el.id, value);
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                setEditingId(null);
              }
            }}
          >
            {el.label}
          </div>
        );
      }

      if (!el.label.trim()) return null;

      return (
        <div
          style={{
            width: "100%",
            color: el.textColor,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            textAlign: el.textAlign,
            lineHeight: 1.2,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            padding: "2px 6px",
          }}
        >
          {el.label}
        </div>
      );
    }

    if (el.type === "list") {
      const ListTag = el.ordered ? "ol" : "ul";
      return (
        <ListTag
          style={{
            margin: 0,
            paddingInlineStart: 26,
            color: el.color,
            fontSize: el.fontSize,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            lineHeight: el.lineHeight,
          }}
        >
          {el.items.map((item, index) => (
            <li key={`${el.id}-${index}`}>{item}</li>
          ))}
        </ListTag>
      );
    }

    if (el.type === "table") {
      return (
        <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: el.fontSize,
              color: el.textColor,
              background: "#ffffff",
            }}
          >
            <thead>
              <tr>
                {el.headers.map((header, index) => (
                  <th
                    key={`${el.id}-h-${index}`}
                    style={{
                      border: `1px solid ${el.borderColor}`,
                      background: el.headerFill,
                      padding: "8px 10px",
                      textAlign: "left",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {el.rows.map((row, rowIndex) => (
                <tr key={`${el.id}-r-${rowIndex}`}>
                  {el.headers.map((_, columnIndex) => (
                    <td
                      key={`${el.id}-c-${rowIndex}-${columnIndex}`}
                      style={{
                        border: `1px solid ${el.borderColor}`,
                        padding: "8px 10px",
                      }}
                    >
                      {row[columnIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (el.type === "media") {
      const commonStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        objectFit: el.fit,
        borderRadius: el.borderRadius,
        background: el.background,
      };

      if (el.mediaKind === "video") {
        return el.src ? (
          <video controls style={commonStyle} src={el.src} />
        ) : (
          <div
            style={commonStyle}
            className="flex items-center justify-center text-slate-600 font-medium"
          >
            Zone video
          </div>
        );
      }

      return el.src ? (
        <img style={commonStyle} src={el.src} alt={el.alt || "image"} />
      ) : (
        <div
          style={commonStyle}
          className="flex items-center justify-center text-slate-600 font-medium"
        >
          Zone image
        </div>
      );
    }

    if (el.type === "icon") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: el.fontSize,
            color: el.color,
            background: el.background,
            borderRadius: 18,
          }}
        >
          {iconFor(el.iconName)}
        </div>
      );
    }

    if (el.type === "chart") {
      const max = Math.max(...el.values, 1);
      const count = Math.max(el.values.length, 1);
      return (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${el.width} ${el.height}`}
          role="img"
          aria-label="chart"
        >
          <rect
            x={0}
            y={0}
            width={el.width}
            height={el.height}
            fill="#ffffff"
            rx={16}
          />
          {el.chartKind === "bar" &&
            el.values.map((value, index) => {
              const barWidth = (el.width - 80) / count - 12;
              const x = 50 + index * ((el.width - 80) / count);
              const h = ((el.height - 120) * value) / max;
              const y = el.height - 50 - h;
              return (
                <g key={`${el.id}-bar-${index}`}>
                  <rect
                    x={x}
                    y={y}
                    width={Math.max(20, barWidth)}
                    height={h}
                    rx={8}
                    fill={el.palette[index % el.palette.length] ?? "#0ea5e9"}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={el.height - 20}
                    textAnchor="middle"
                    fontSize={16}
                    fill="#334155"
                  >
                    {el.labels[index] ?? ""}
                  </text>
                </g>
              );
            })}
          {el.chartKind === "line" && (
            <>
              <polyline
                fill="none"
                stroke={el.strokeColor}
                strokeWidth={4}
                points={el.values
                  .map((value, index) => {
                    const px =
                      40 +
                      index *
                        ((el.width - 80) / Math.max(el.values.length - 1, 1));
                    const py =
                      el.height - 50 - ((el.height - 120) * value) / max;
                    return `${px},${py}`;
                  })
                  .join(" ")}
              />
              {el.values.map((value, index) => {
                const px =
                  40 +
                  index * ((el.width - 80) / Math.max(el.values.length - 1, 1));
                const py = el.height - 50 - ((el.height - 120) * value) / max;
                return (
                  <circle
                    key={`${el.id}-line-${index}`}
                    cx={px}
                    cy={py}
                    r={6}
                    fill={el.palette[index % el.palette.length] ?? "#0ea5e9"}
                  />
                );
              })}
            </>
          )}
        </svg>
      );
    }

    if (el.type === "columns") {
      const columnWidth =
        (el.width - el.gap * (el.columns.length - 1)) /
        Math.max(el.columns.length, 1);
      return (
        <div
          style={{
            display: "flex",
            gap: el.gap,
            width: "100%",
            height: "100%",
          }}
        >
          {el.columns.map((column, index) => (
            <div
              key={`${el.id}-column-${index}`}
              style={{
                width: columnWidth,
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 16,
                padding: 18,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  color: el.titleColor,
                  fontWeight: 700,
                  fontSize: 22,
                  marginBottom: 8,
                }}
              >
                {column[0] ?? `Colonne ${index + 1}`}
              </div>
              <div
                style={{
                  color: el.textColor,
                  fontSize: 20,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                }}
              >
                {column.slice(1).join("\n")}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (el.type === "group") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: `2px dashed ${el.borderColor}`,
            borderRadius: 18,
            background: el.fill,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            padding: 10,
            color: "#475569",
            fontWeight: 600,
          }}
        >
          {el.label}
        </div>
      );
    }

    if (el.type === "background") {
      const pattern =
        el.pattern === "grid"
          ? "linear-gradient(90deg, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(15,23,42,0.08) 1px, transparent 1px)"
          : el.pattern === "dots"
            ? "radial-gradient(circle, rgba(15,23,42,0.14) 1px, transparent 1px)"
            : "none";
      const backgroundSize = el.pattern === "grid" ? "28px 28px" : "20px 20px";
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${el.fill}, ${el.accent})`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {el.pattern !== "none" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: pattern,
                backgroundSize,
                opacity: 0.35,
              }}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-white">
      {size.width > 0 && size.height > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            style={{
              width: stageW,
              height: stageH,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              ref={sceneRef}
              data-slide-scene="true"
              style={{
                width: W,
                height: H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "relative",
                background: scene.background || "#ffffff",
              }}
              onMouseMove={(event) => {
                const target = event.target as HTMLElement | null;
                const wrapper = target?.closest<HTMLElement>(
                  "[data-element-wrapper][data-element-id]",
                );
                const nextId = wrapper?.dataset.elementId ?? null;
                setHoveredId((current) =>
                  current === nextId ? current : nextId,
                );
              }}
              onMouseLeave={() => setHoveredId(null)}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  onSelectionChange([]);
                  setEditingId(null);
                }
              }}
            >
              {elements.map((el) => {
                const selected = selectedIds.includes(el.id);
                const editing = editingId === el.id;
                const hovered = hoveredId === el.id;
                const isText = el.type === "text";
                const isShape = el.type === "shape";
                const isInlineEditable = isText || isShape;
                const isFixedBackground = isFixedBackgroundElement(el);
                const primarySelectedId = selectedIds[selectedIds.length - 1];
                const defaultShadow = "none";
                const interactionBorderWidth = bw;
                const interactionActive =
                  !editing &&
                  (hovered ||
                    selected ||
                    (isFixedBackground && hoveredId !== null));

                return (
                  <div
                    key={el.id}
                    data-element-wrapper
                    data-element-id={el.id}
                    ref={(node) => {
                      if (node) nodeMap.current.set(el.id, node);
                      else nodeMap.current.delete(el.id);
                    }}
                    style={{
                      position: "absolute",
                      zIndex: el.zIndex,
                      left: el.x,
                      top: el.y,
                      ...(isText
                        ? {
                            width: "max-content",
                            maxWidth: el.width,
                            minWidth: MIN_SIZE,
                          }
                        : {
                            width: el.width,
                          }),
                      ...(isText ? {} : { height: el.height }),
                      transform: el.rotation
                        ? `rotate(${el.rotation}deg)`
                        : undefined,
                      transformOrigin: "center center",
                      opacity: el.opacity,
                      cursor:
                        el.locked || isFixedBackground
                          ? "default"
                          : editing
                            ? "text"
                            : "move",
                      userSelect: editing ? "text" : "none",
                      boxSizing: "border-box",
                      boxShadow: defaultShadow,
                      outline: interactionActive
                        ? `${interactionBorderWidth}px solid ${INTERACTION_BORDER_COLOR}`
                        : "none",
                      outlineOffset: interactionActive ? "0px" : undefined,
                      transition: "none",
                      ...(isText
                        ? {
                            color: el.color,
                            fontSize: el.fontSize,
                            fontFamily: el.fontFamily,
                            fontWeight: el.fontWeight,
                            fontStyle:
                              el.fontStyle === "italic" ? "italic" : "normal",
                            textAlign:
                              el.align as React.CSSProperties["textAlign"],
                            lineHeight: el.lineHeight,
                            whiteSpace: "pre-wrap" as const,
                            wordBreak: "break-word" as const,
                            overflow: "visible" as const,
                          }
                        : {}),
                      ...(isShape
                        ? {
                            backgroundColor: el.fill,
                            border:
                              el.strokeWidth > 0
                                ? `${Math.max(1.5, el.strokeWidth)}px solid ${el.stroke}`
                                : undefined,
                            borderRadius:
                              el.shape === "ellipse"
                                ? "50%"
                                : el.cornerRadius > 0
                                  ? el.cornerRadius
                                  : undefined,
                            display: "flex",
                            alignItems: "center",
                            justifyContent:
                              el.textAlign === "left"
                                ? "flex-start"
                                : el.textAlign === "right"
                                  ? "flex-end"
                                  : "center",
                            padding: isFixedBackground ? 0 : "10px",
                          }
                        : {}),
                    }}
                    onMouseDown={(event) => {
                      if (editing) return;
                      event.stopPropagation();

                      if (event.shiftKey) {
                        if (selected) {
                          onSelectionChange(
                            selectedIds.filter((id) => id !== el.id),
                          );
                        } else {
                          onSelectionChange([...selectedIds, el.id]);
                        }
                        return;
                      }

                      const keepGroupSelection =
                        selected && selectedIds.length > 1;
                      const dragIds = keepGroupSelection
                        ? selectedIds
                        : [el.id];
                      if (!keepGroupSelection) onSelectionChange([el.id]);

                      if (el.locked || isFixedBackground) return;

                      const entries = dragIds
                        .map((id) => {
                          const item = scene.elements.find(
                            (element) => element.id === id,
                          );
                          const node = nodeMap.current.get(id);
                          if (!item || !node) return null;
                          return {
                            id,
                            x: item.x,
                            y: item.y,
                            width: node.offsetWidth || item.width,
                            height: node.offsetHeight || item.height,
                            node,
                          };
                        })
                        .filter(
                          (
                            entry,
                          ): entry is {
                            id: string;
                            x: number;
                            y: number;
                            width: number;
                            height: number;
                            node: HTMLDivElement;
                          } => entry !== null,
                        );
                      if (entries.length === 0) return;

                      const minX = Math.min(...entries.map((item) => item.x));
                      const minY = Math.min(...entries.map((item) => item.y));
                      const maxX = Math.max(
                        ...entries.map((item) => item.x + item.width),
                      );
                      const maxY = Math.max(
                        ...entries.map((item) => item.y + item.height),
                      );

                      const sc = toScene(event.clientX, event.clientY);
                      dragR.current = {
                        ids: dragIds,
                        sx: sc.x,
                        sy: sc.y,
                        boxX: minX,
                        boxY: minY,
                        boxWidth: maxX - minX,
                        boxHeight: maxY - minY,
                        entries,
                        moved: false,
                        guides: collectGuides(
                          scene,
                          dragIds,
                          maxX - minX,
                          maxY - minY,
                        ),
                      };
                    }}
                    onDoubleClick={() => {
                      if (
                        isInlineEditable &&
                        !el.locked &&
                        !isFixedBackground
                      ) {
                        setEditingId(el.id);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderElementContent(el, editing)}

                    {selected &&
                      primarySelectedId === el.id &&
                      !editing &&
                      !el.locked &&
                      !isFixedBackground && (
                        <SelectionOverlay
                          element={el}
                          bw={bw}
                          hs={hs}
                          hb={hb}
                          rh={rh}
                          onStartResize={(corner, event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            const parent = (
                              event.target as HTMLElement
                            ).closest<HTMLDivElement>("[data-element-wrapper]");
                            if (!parent) return;
                            const sc = toScene(event.clientX, event.clientY);
                            resizeR.current = {
                              id: el.id,
                              corner,
                              text: isText,
                              shapeElement: el.type === "shape",
                              baseShapeFontSize:
                                el.type === "shape" ? el.fontSize : 0,
                              sx: sc.x,
                              sy: sc.y,
                              ox: el.x,
                              oy: el.y,
                              ow: isText ? parent.offsetWidth : el.width,
                              oh: isText ? parent.offsetHeight : el.height,
                              node: parent,
                            };
                          }}
                          onStartRotate={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            const parent = (
                              event.target as HTMLElement
                            ).closest<HTMLDivElement>("[data-element-wrapper]");
                            if (!parent) return;
                            rotateR.current = {
                              id: el.id,
                              cx: el.x + parent.offsetWidth / 2,
                              cy: el.y + parent.offsetHeight / 2,
                              node: parent,
                            };
                          }}
                        />
                      )}
                  </div>
                );
              })}

              {activeGuides.map((guide, index) =>
                guide.orientation === "vertical" ? (
                  <div
                    key={`guide-v-${guide.value}-${index}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: guide.value,
                      width: 1,
                      height: H,
                      background: "rgba(13,153,255,0.85)",
                      pointerEvents: "none",
                    }}
                  />
                ) : (
                  <div
                    key={`guide-h-${guide.value}-${index}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: guide.value,
                      width: W,
                      height: 1,
                      background: "rgba(13,153,255,0.85)",
                      pointerEvents: "none",
                    }}
                  />
                ),
              )}

              {spacingMarkers.map((marker, index) =>
                marker.orientation === "horizontal" ? (
                  <div key={`spacing-h-${index}`}>
                    <div
                      style={{
                        position: "absolute",
                        left: marker.start,
                        top: marker.at,
                        width: Math.max(1, marker.end - marker.start),
                        height: 0,
                        borderTop: "1px dashed rgba(249,115,22,0.95)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: (marker.start + marker.end) / 2,
                        top: marker.at - 14,
                        transform: "translateX(-50%)",
                        background: "rgba(249,115,22,0.95)",
                        color: "#ffffff",
                        fontSize: 10,
                        lineHeight: 1,
                        padding: "3px 4px",
                        borderRadius: 4,
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {marker.label}
                    </div>
                  </div>
                ) : (
                  <div key={`spacing-v-${index}`}>
                    <div
                      style={{
                        position: "absolute",
                        left: marker.at,
                        top: marker.start,
                        width: 0,
                        height: Math.max(1, marker.end - marker.start),
                        borderLeft: "1px dashed rgba(249,115,22,0.95)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: marker.at + 6,
                        top: (marker.start + marker.end) / 2,
                        transform: "translateY(-50%)",
                        background: "rgba(249,115,22,0.95)",
                        color: "#ffffff",
                        fontSize: 10,
                        lineHeight: 1,
                        padding: "3px 4px",
                        borderRadius: 4,
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {marker.label}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionOverlay({
  element,
  bw,
  hs,
  hb,
  rh,
  onStartResize,
  onStartRotate,
}: {
  element: SlideElement;
  bw: number;
  hs: number;
  hb: number;
  rh: number;
  onStartResize: (corner: ResizeHandle, event: React.MouseEvent) => void;
  onStartRotate: (event: React.MouseEvent) => void;
}) {
  const radius =
    element.type === "shape" && element.shape === "ellipse"
      ? "50%"
      : element.type === "shape" && element.cornerRadius > 0
        ? element.cornerRadius + bw
        : 0;
  const isText = element.type === "text";

  if (isText) {
    return (
      <>
        {(["w", "e"] as const).map((side) => (
          <div
            key={side}
            style={{
              position: "absolute",
              width: hs * 0.85,
              height: hs * 0.85,
              background: "#ffffff",
              border: `${hb}px solid ${INTERACTION_BORDER_COLOR}`,
              borderRadius: hb,
              top: "50%",
              transform: "translateY(-50%)",
              ...(side === "w" ? { left: -hs / 2 } : { right: -hs / 2 }),
              cursor: "ew-resize",
              zIndex: 52,
            }}
            onMouseDown={(event) => onStartResize(side, event)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: -bw,
          border: "none",
          borderRadius: radius,
          pointerEvents: "none",
        }}
      />

      {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
        <div
          key={corner}
          style={{
            position: "absolute",
            width: hs,
            height: hs,
            background: "#ffffff",
            border: `${hb}px solid ${INTERACTION_BORDER_COLOR}`,
            borderRadius: hb,
            ...(corner.includes("n") ? { top: -hs / 2 } : { bottom: -hs / 2 }),
            ...(corner.includes("w") ? { left: -hs / 2 } : { right: -hs / 2 }),
            cursor: isText
              ? "ew-resize"
              : corner === "nw" || corner === "se"
                ? "nwse-resize"
                : "nesw-resize",
            zIndex: 50,
          }}
          onMouseDown={(event) => onStartResize(corner, event)}
        />
      ))}

      <button
        type="button"
        style={{
          position: "absolute",
          right: -(rh * 2.2 + 16),
          top: "50%",
          width: rh * 2.2,
          height: rh * 2.2,
          borderRadius: "50%",
          background: "#ffffff",
          border: `${hb}px solid ${INTERACTION_BORDER_COLOR}`,
          transform: "translateY(-50%)",
          cursor: "grab",
          zIndex: 55,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: INTERACTION_BORDER_COLOR,
        }}
        aria-label="Tourner"
        onMouseDown={onStartRotate}
      >
        <RotateCw size={Math.max(12, rh * 1.1)} strokeWidth={2.2} />
      </button>
    </>
  );
}
