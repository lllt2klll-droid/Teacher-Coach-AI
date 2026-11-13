import type { CSSProperties } from 'react';
import type { PresentationSlide, SlideParagraph, SlideTextRun } from '@/types/domain';
import { cn } from '@/lib/utils';

interface SlideRendererProps {
  slide: PresentationSlide;
  slideWidthEmu: number;
  slideHeightEmu: number;
  assetUrls: Map<string, string>;
  className?: string;
}

const EMU_PER_PT = 12_700;
const DEFAULT_FONT_PT = 18;

function cqw(valuePt: number, slideWidthPt: number): string {
  return `${(valuePt / slideWidthPt) * 100}cqw`;
}

function shapeRadius(preset: string | undefined): string | undefined {
  if (preset === 'roundRect') return '1.2cqw';
  if (preset === 'ellipse' || preset === 'circle') return '50%';
  return undefined;
}

function runStyle(run: SlideTextRun, slideWidthPt: number): CSSProperties {
  return {
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? 'italic' : undefined,
    textDecoration: run.underline ? 'underline' : undefined,
    color: run.color,
    fontFamily: run.fontFamily,
    fontSize: cqw(run.fontSizePt && run.fontSizePt > 0 ? run.fontSizePt : DEFAULT_FONT_PT, slideWidthPt),
  };
}

function Paragraph({ paragraph, slideWidthPt }: { paragraph: SlideParagraph; slideWidthPt: number }) {
  const level = paragraph.level ?? 0;
  const indent = level * 2.2 + (paragraph.bullet ? 1.6 : 0);
  return (
    <p
      style={{
        margin: 0,
        paddingLeft: cqw(indent, slideWidthPt),
        textAlign: paragraph.align,
        textIndent: paragraph.bullet ? cqw(-1.6, slideWidthPt) : undefined,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
      }}
    >
      {paragraph.bullet && <span aria-hidden>• </span>}
      {paragraph.runs.map((run, index) => (
        <span key={index} style={runStyle(run, slideWidthPt)}>
          {run.text}
        </span>
      ))}
    </p>
  );
}

function BackgroundImage({ url }: { url: string }) {
  return <img src={url} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover" />;
}

export function SlideRenderer({ slide, slideWidthEmu, slideHeightEmu, assetUrls, className }: SlideRendererProps) {
  const slideWidthPt = Math.max(1, slideWidthEmu / EMU_PER_PT);
  const backgroundUrl = slide.background.assetId ? assetUrls.get(slide.background.assetId) : undefined;
  const visualUrl = slide.visualAssetId ? assetUrls.get(slide.visualAssetId) : undefined;

  // A PDF page exported from PowerPoint is the faithful representation. It is
  // shown as-is instead of the approximate HTML reconstruction.
  if (visualUrl) {
    return (
      <div
        role="img"
        aria-label={`Slide ${slide.index + 1}: ${slide.title || 'Chưa có tiêu đề'}`}
        className={cn('relative w-full overflow-hidden bg-white', className)}
        style={{ aspectRatio: `${slideWidthEmu} / ${slideHeightEmu}` }}
      >
        <img src={visualUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Slide ${slide.index + 1}: ${slide.title || 'Chưa có tiêu đề'}`}
      className={cn('relative isolate w-full overflow-hidden [container-type:inline-size]', className)}
      style={{
        aspectRatio: `${slideWidthEmu} / ${slideHeightEmu}`,
        backgroundColor: slide.background.color ?? '#ffffff',
      }}
    >
      {backgroundUrl && <BackgroundImage url={backgroundUrl} />}

      {slide.elements.map((element) => {
        const rotation = 'rotationDeg' in element ? element.rotationDeg : undefined;
        const transform = rotation ? `rotate(${rotation}deg)` : undefined;
        if (element.kind === 'image') {
          const url = assetUrls.get(element.assetId);
          const left = element.crop?.left ?? 0;
          const top = element.crop?.top ?? 0;
          const right = element.crop?.right ?? 0;
          const bottom = element.crop?.bottom ?? 0;
          const visibleWidth = Math.max(0.02, 1 - left - right);
          const visibleHeight = Math.max(0.02, 1 - top - bottom);
          return (
            <div
              key={element.id}
              className="absolute overflow-hidden"
              style={{
                left: `${element.x * 100}%`,
                top: `${element.y * 100}%`,
                width: `${element.width * 100}%`,
                height: `${element.height * 100}%`,
                transform,
              }}
            >
              {url ? (
                <img
                  src={url}
                  alt={element.alt ?? ''}
                  className="absolute max-w-none object-fill"
                  style={{
                    width: `${100 / visibleWidth}%`,
                    height: `${100 / visibleHeight}%`,
                    left: `${-(left / visibleWidth) * 100}%`,
                    top: `${-(top / visibleHeight) * 100}%`,
                  }}
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-[#eef2f8] px-1 text-center text-[1.2cqw] font-medium text-[#7a8698]">
                  Ảnh không đọc được
                </div>
              )}
            </div>
          );
        }

        if (element.kind === 'table') {
          const rows = element.rows;
          return (
            <div
              key={element.id}
              className="absolute overflow-hidden"
              style={{
                left: `${element.x * 100}%`,
                top: `${element.y * 100}%`,
                width: `${element.width * 100}%`,
                height: `${element.height * 100}%`,
                transform,
                display: 'grid',
                gridTemplateColumns: element.columnWidths.map((width) => `${width * 100}%`).join(' '),
                gridTemplateRows:
                  element.rowHeights?.length === rows.length
                    ? element.rowHeights.map((height) => `${height * 100}%`).join(' ')
                    : `repeat(${Math.max(1, rows.length)}, minmax(0, 1fr))`,
                fontSize: cqw(15, slideWidthPt),
              }}
            >
              {rows.flatMap((row, rowIndex) =>
                row.map((cell, cellIndex) => (
                  <div
                    key={`${rowIndex}-${cellIndex}`}
                    className="min-h-0 overflow-hidden border-[0.08cqw] border-[#2b3648]/25 bg-white/60 px-[0.5cqw] py-[0.35cqw] leading-[1.25]"
                    style={{ fontWeight: cell.bold ? 700 : undefined }}
                  >
                    {cell.text}
                  </div>
                )),
              )}
            </div>
          );
        }

        return (
          <div
            key={element.id}
            className="absolute flex flex-col overflow-hidden"
            style={{
              left: `${element.x * 100}%`,
              top: `${element.y * 100}%`,
              width: `${element.width * 100}%`,
              height: `${element.height * 100}%`,
              transform,
              backgroundColor: element.fill,
              border: element.borderColor
                ? `${cqw(Math.max(0.75, element.borderWidthPt ?? 1), slideWidthPt)} solid ${element.borderColor}`
                : undefined,
              borderRadius: shapeRadius(element.preset),
              justifyContent:
                element.anchor === 'middle' ? 'center' : element.anchor === 'bottom' ? 'flex-end' : 'flex-start',
              paddingTop: cqw(element.insetTopPt ?? 3.6, slideWidthPt),
              paddingBottom: cqw(element.insetBottomPt ?? 3.6, slideWidthPt),
              paddingLeft: cqw(element.insetLeftPt ?? 7.2, slideWidthPt),
              paddingRight: cqw(element.insetRightPt ?? 7.2, slideWidthPt),
              gap: cqw(2, slideWidthPt),
              fontSize: cqw(DEFAULT_FONT_PT, slideWidthPt),
              lineHeight: 1.18,
              color: '#1f2937',
            }}
          >
            {element.paragraphs.map((paragraph, index) => (
              <Paragraph key={index} paragraph={paragraph} slideWidthPt={slideWidthPt} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
