import type { SlideElement } from "@/services/api";
import { RotateCw } from "lucide-react";

interface ElementPropertiesPanelProps {
  element: SlideElement | null;
  onUpdateStyle: (patch: Record<string, unknown>) => void;
  onUpdateText: (value: string) => void;
  onAlignText: (align: "left" | "center" | "right") => void;
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "color";
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="grid grid-cols-[70px_1fr] items-center gap-2 text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-400"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="grid grid-cols-[70px_1fr] items-center gap-2 text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ElementPropertiesPanel({
  element,
  onUpdateStyle,
  onUpdateText,
  onAlignText,
}: ElementPropertiesPanelProps) {
  if (!element) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
        Selectionnez un element pour modifier ses proprietes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Geometrie
        </p>
        <LabeledInput
          label="X"
          type="number"
          value={Math.round(element.x)}
          onChange={(v) => onUpdateStyle({ x: toNumber(v, element.x) })}
        />
        <LabeledInput
          label="Y"
          type="number"
          value={Math.round(element.y)}
          onChange={(v) => onUpdateStyle({ y: toNumber(v, element.y) })}
        />
        <LabeledInput
          label="W"
          type="number"
          value={Math.round(element.width)}
          onChange={(v) =>
            onUpdateStyle({ width: Math.max(16, toNumber(v, element.width)) })
          }
        />
        <LabeledInput
          label="H"
          type="number"
          value={Math.round(element.height)}
          onChange={(v) =>
            onUpdateStyle({ height: Math.max(16, toNumber(v, element.height)) })
          }
        />
        <div className="grid grid-cols-[70px_1fr] items-center gap-2 text-xs">
          <span className="text-slate-600 font-medium">Rotation</span>
          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-slate-600">
            <RotateCw className="size-3.5" />
            <span>Utilisez l'icone a droite de l'element</span>
          </div>
        </div>
        <LabeledInput
          label="Opacite"
          type="number"
          min={0.05}
          max={1}
          step={0.05}
          value={Number(element.opacity.toFixed(2))}
          onChange={(v) =>
            onUpdateStyle({
              opacity: Math.min(
                1,
                Math.max(0.05, toNumber(v, element.opacity)),
              ),
            })
          }
        />
      </div>

      {(element.type === "text" || element.type === "list") && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Typographie
          </p>
          {element.type === "text" && (
            <label className="block text-xs text-slate-600 font-medium">
              Contenu
              <textarea
                value={element.text}
                onChange={(event) => onUpdateText(event.target.value)}
                className="mt-1 min-h-22 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-400"
              />
            </label>
          )}
          {element.type === "list" && (
            <label className="block text-xs text-slate-600 font-medium">
              Lignes
              <textarea
                value={element.items.join("\n")}
                onChange={(event) =>
                  onUpdateStyle({
                    items: event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-1 min-h-22 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-400"
              />
            </label>
          )}
          <LabeledInput
            label="Taille"
            type="number"
            min={8}
            max={220}
            value={element.fontSize}
            onChange={(v) =>
              onUpdateStyle({ fontSize: toNumber(v, element.fontSize) })
            }
          />
          <LabeledInput
            label="Poids"
            type="number"
            min={100}
            max={900}
            step={100}
            value={element.fontWeight}
            onChange={(v) =>
              onUpdateStyle({ fontWeight: toNumber(v, element.fontWeight) })
            }
          />
          <LabeledInput
            label="Couleur"
            type="color"
            value={element.color}
            onChange={(v) => onUpdateStyle({ color: v })}
          />
          <LabeledInput
            label="Interligne"
            type="number"
            min={1}
            max={2.6}
            step={0.05}
            value={element.lineHeight}
            onChange={(v) =>
              onUpdateStyle({ lineHeight: toNumber(v, element.lineHeight) })
            }
          />
          {element.type === "text" && (
            <div className="flex items-center gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => onAlignText(align)}
                  className={`h-8 rounded-md border px-2 text-xs font-medium ${
                    element.align === align
                      ? "border-sky-400 bg-sky-50 text-sky-700"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {element.type === "shape" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Bordures et remplissage
          </p>
          <label className="block text-xs text-slate-600 font-medium">
            Texte de la forme
            <textarea
              value={element.label}
              onChange={(event) => onUpdateText(event.target.value)}
              className="mt-1 min-h-18 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <LabeledInput
            label="Fond"
            type="color"
            value={element.fill}
            onChange={(v) => onUpdateStyle({ fill: v })}
          />
          <LabeledInput
            label="Bordure"
            type="color"
            value={element.stroke}
            onChange={(v) => onUpdateStyle({ stroke: v })}
          />
          <LabeledInput
            label="Epaisseur"
            type="number"
            min={0}
            max={24}
            value={element.strokeWidth}
            onChange={(v) =>
              onUpdateStyle({ strokeWidth: toNumber(v, element.strokeWidth) })
            }
          />
          <LabeledInput
            label="Rayon"
            type="number"
            min={0}
            max={300}
            value={element.cornerRadius}
            onChange={(v) =>
              onUpdateStyle({ cornerRadius: toNumber(v, element.cornerRadius) })
            }
          />
          <LabeledInput
            label="Texte"
            type="color"
            value={element.textColor}
            onChange={(v) => onUpdateStyle({ textColor: v })}
          />
          <LabeledInput
            label="Taille"
            type="number"
            min={8}
            max={220}
            value={element.fontSize}
            onChange={(v) =>
              onUpdateStyle({ fontSize: toNumber(v, element.fontSize) })
            }
          />
          <LabeledInput
            label="Poids"
            type="number"
            min={100}
            max={900}
            step={100}
            value={element.fontWeight}
            onChange={(v) =>
              onUpdateStyle({ fontWeight: toNumber(v, element.fontWeight) })
            }
          />
          <LabeledSelect
            label="Align"
            value={element.textAlign}
            onChange={(value) => onUpdateStyle({ textAlign: value })}
            options={[
              { label: "Gauche", value: "left" },
              { label: "Centre", value: "center" },
              { label: "Droite", value: "right" },
            ]}
          />
        </div>
      )}

      {element.type === "media" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Media
          </p>
          <LabeledInput
            label="Source"
            value={element.src}
            onChange={(v) => onUpdateStyle({ src: v })}
          />
          <LabeledInput
            label="Alt"
            value={element.alt}
            onChange={(v) => onUpdateStyle({ alt: v })}
          />
          <LabeledInput
            label="Fond"
            type="color"
            value={element.background}
            onChange={(v) => onUpdateStyle({ background: v })}
          />
          <LabeledInput
            label="Rayon"
            type="number"
            min={0}
            max={160}
            value={element.borderRadius}
            onChange={(v) =>
              onUpdateStyle({ borderRadius: toNumber(v, element.borderRadius) })
            }
          />
          <LabeledSelect
            label="Mode"
            value={element.fit}
            onChange={(value) => onUpdateStyle({ fit: value })}
            options={[
              { label: "Cover", value: "cover" },
              { label: "Contain", value: "contain" },
            ]}
          />
        </div>
      )}

      {element.type === "table" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tableau
          </p>
          <LabeledInput
            label="Taille"
            type="number"
            min={8}
            max={120}
            value={element.fontSize}
            onChange={(v) =>
              onUpdateStyle({ fontSize: toNumber(v, element.fontSize) })
            }
          />
          <LabeledInput
            label="Texte"
            type="color"
            value={element.textColor}
            onChange={(v) => onUpdateStyle({ textColor: v })}
          />
          <LabeledInput
            label="Bordure"
            type="color"
            value={element.borderColor}
            onChange={(v) => onUpdateStyle({ borderColor: v })}
          />
          <LabeledInput
            label="Header"
            type="color"
            value={element.headerFill}
            onChange={(v) => onUpdateStyle({ headerFill: v })}
          />
          <label className="block text-xs text-slate-600 font-medium">
            Entetes (separes par |)
            <input
              type="text"
              value={element.headers.join(" | ")}
              onChange={(event) =>
                onUpdateStyle({
                  headers: event.target.value
                    .split("|")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <label className="block text-xs text-slate-600 font-medium">
            Lignes (une ligne par ligne, cellules separees par |)
            <textarea
              value={element.rows.map((row) => row.join(" | ")).join("\n")}
              onChange={(event) =>
                onUpdateStyle({
                  rows: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => line.split("|").map((cell) => cell.trim())),
                })
              }
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </label>
        </div>
      )}

      {element.type === "icon" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Icone
          </p>
          <LabeledInput
            label="Nom"
            value={element.iconName}
            onChange={(v) => onUpdateStyle({ iconName: v })}
          />
          <LabeledInput
            label="Couleur"
            type="color"
            value={element.color}
            onChange={(v) => onUpdateStyle({ color: v })}
          />
          <LabeledInput
            label="Fond"
            type="color"
            value={element.background}
            onChange={(v) => onUpdateStyle({ background: v })}
          />
          <LabeledInput
            label="Taille"
            type="number"
            min={8}
            max={220}
            value={element.fontSize}
            onChange={(v) =>
              onUpdateStyle({ fontSize: toNumber(v, element.fontSize) })
            }
          />
        </div>
      )}

      {element.type === "chart" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Graphique
          </p>
          <LabeledSelect
            label="Type"
            value={element.chartKind}
            onChange={(value) => onUpdateStyle({ chartKind: value })}
            options={[
              { label: "Barres", value: "bar" },
              { label: "Ligne", value: "line" },
            ]}
          />
          <label className="block text-xs text-slate-600 font-medium">
            Labels (separes par |)
            <input
              type="text"
              value={element.labels.join(" | ")}
              onChange={(event) =>
                onUpdateStyle({
                  labels: event.target.value
                    .split("|")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <label className="block text-xs text-slate-600 font-medium">
            Valeurs (separees par |)
            <input
              type="text"
              value={element.values.join(" | ")}
              onChange={(event) =>
                onUpdateStyle({
                  values: event.target.value
                    .split("|")
                    .map((item) => Number(item.trim()))
                    .filter((item) => Number.isFinite(item)),
                })
              }
              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-400"
            />
          </label>
          <LabeledInput
            label="Trace"
            type="color"
            value={element.strokeColor}
            onChange={(v) => onUpdateStyle({ strokeColor: v })}
          />
        </div>
      )}

      {element.type === "columns" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Colonnes
          </p>
          <LabeledInput
            label="Gap"
            type="number"
            min={0}
            max={160}
            value={element.gap}
            onChange={(v) => onUpdateStyle({ gap: toNumber(v, element.gap) })}
          />
          <LabeledInput
            label="Titre"
            type="color"
            value={element.titleColor}
            onChange={(v) => onUpdateStyle({ titleColor: v })}
          />
          <LabeledInput
            label="Texte"
            type="color"
            value={element.textColor}
            onChange={(v) => onUpdateStyle({ textColor: v })}
          />
          <label className="block text-xs text-slate-600 font-medium">
            Colonnes (format: titre | item 1 | item 2, une colonne par ligne)
            <textarea
              value={element.columns.map((col) => col.join(" | ")).join("\n")}
              onChange={(event) =>
                onUpdateStyle({
                  columns: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) =>
                      line
                        .split("|")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    ),
                })
              }
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </label>
        </div>
      )}

      {element.type === "group" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Groupe
          </p>
          <LabeledInput
            label="Label"
            value={element.label}
            onChange={(v) => onUpdateStyle({ label: v })}
          />
          <LabeledInput
            label="Fond"
            type="color"
            value={element.fill}
            onChange={(v) => onUpdateStyle({ fill: v })}
          />
          <LabeledInput
            label="Bordure"
            type="color"
            value={element.borderColor}
            onChange={(v) => onUpdateStyle({ borderColor: v })}
          />
        </div>
      )}

      {element.type === "background" && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Arriere-plan
          </p>
          <LabeledInput
            label="Base"
            type="color"
            value={element.fill}
            onChange={(v) => onUpdateStyle({ fill: v })}
          />
          <LabeledInput
            label="Accent"
            type="color"
            value={element.accent}
            onChange={(v) => onUpdateStyle({ accent: v })}
          />
          <LabeledSelect
            label="Motif"
            value={element.pattern}
            onChange={(v) => onUpdateStyle({ pattern: v })}
            options={[
              { label: "Aucun", value: "none" },
              { label: "Points", value: "dots" },
              { label: "Grille", value: "grid" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
