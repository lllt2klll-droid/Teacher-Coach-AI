import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { parsePptxBuffer, PresentationParseError } from '@/services/presentation/pptx-parser';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function makeTextShape(options: {
  id: string;
  placeholder?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size?: number;
  paragraphs: string[];
}): string {
  const paragraphs = options.paragraphs
    .map(
      (text, index) =>
        `<a:p>${index === 0 ? '<a:pPr><a:buChar char="•"/></a:pPr>' : ''}<a:r><a:rPr lang="vi-VN" sz="${options.size ?? 2400}" ${
          index === 0 && options.placeholder === 'title' ? 'b="1"' : ''
        }><a:solidFill><a:srgbClr val="${index === 0 ? 'C00000' : '1F2937'}"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p>`,
    )
    .join('');
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${options.id}" name="Shape ${options.id}"/><p:cNvSpPr/><p:nvPr>${
      options.placeholder ? `<p:ph type="${options.placeholder}"/>` : ''
    }</p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${options.x}" y="${options.y}"/><a:ext cx="${options.width}" cy="${options.height}"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody>
  </p:sp>`;
}

function makeSlide(title: string, body: string, withMedia: boolean): string {
  const media = withMedia
    ? `<p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Picture 3" descr="Sơ đồ bảng nhân"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="10000" t="5000" r="10000" b="5000"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="8000000" y="2200000"/><a:ext cx="3000000" cy="2500000"/></a:xfrm></p:spPr>
      </p:pic>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="5" name="Table 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="914400" y="2200000"/><a:ext cx="5000000" cy="1800000"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblGrid><a:gridCol w="2500000"/><a:gridCol w="2500000"/></a:tblGrid>
            <a:tr h="900000">
              <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Phép nhân</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
              <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Kết quả</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
            </a:tr>
            <a:tr h="900000">
              <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>4 × 2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
              <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>8</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
            </a:tr>
          </a:tbl>
        </a:graphicData></a:graphic>
      </p:graphicFrame>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="6" name="Chart 5"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="914400" y="4400000"/><a:ext cx="3000000" cy="1500000"/></p:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>
        </a:graphicData></a:graphic>
      </p:graphicFrame>`
    : '';

  return `<p:sld ${NS}>
    <p:cSld>
      ${withMedia ? '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF2CC"/></a:solidFill></p:bgPr></p:bg>' : ''}
      <p:spTree>
        <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr/>
        ${makeTextShape({
          id: '2',
          placeholder: 'title',
          x: 914400,
          y: 457200,
          width: 10058400,
          height: 1143000,
          size: 3200,
          paragraphs: [title],
        })}
        ${makeTextShape({
          id: '3',
          placeholder: 'body',
          x: 914400,
          y: 1800000,
          width: 6000000,
          height: 2000000,
          paragraphs: body.split('\n'),
        })}
        ${media}
      </p:spTree>
    </p:cSld>
  </p:sld>`;
}

function makePresentationXml(): string {
  return `<p:presentation ${NS}>
    <p:sldSz cx="12192000" cy="6858000"/>
    <p:sldIdLst>
      <p:sldId id="256" r:id="rId1"/>
      <p:sldId id="257" r:id="rId2"/>
    </p:sldIdLst>
  </p:presentation>`;
}

function makePresentationRels(): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  </Relationships>`;
}

async function buildSyntheticPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', makePresentationXml());
  zip.file('ppt/_rels/presentation.xml.rels', makePresentationRels());
  zip.file('ppt/slides/slide1.xml', makeSlide('Bảng nhân 4', '4 × 1 = 4\n4 × 2 = 8', true));
  zip.file('ppt/slides/slide2.xml', makeSlide('Luyện tập bảng nhân 4', 'Làm bài tập 1, 2, 3', false));
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
    </Relationships>`,
  );
  zip.file('ppt/media/image1.png', Uint8Array.from(atob(PNG_1X1), (char) => char.charCodeAt(0)), { binary: true });
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('parsePptxBuffer', () => {
  it('extracts slide order, text, background, image crop, table and warnings locally', async () => {
    const buffer = await buildSyntheticPptx();
    const progress = vi.fn();
    const draft = await parsePptxBuffer(buffer, {
      fileName: 'bai-giang.pptx',
      fileSize: buffer.byteLength,
      onProgress: progress,
    });

    expect(draft.fileName).toBe('bai-giang.pptx');
    expect(draft.fileSize).toBe(buffer.byteLength);
    expect(draft.slideWidthEmu).toBe(12_192_000);
    expect(draft.slideHeightEmu).toBe(6_858_000);
    expect(draft.slides).toHaveLength(2);
    expect(draft.slides.map((slide) => slide.index)).toEqual([0, 1]);
    expect(draft.slides[0].title).toBe('Bảng nhân 4');
    expect(draft.slides[1].title).toBe('Luyện tập bảng nhân 4');
    expect(draft.slides[0].text).toContain('4 × 1 = 4');
    expect(draft.slides[0].text).toContain('4 × 2 = 8');
    expect(draft.slides[0].text).toContain('Phép nhân');
    expect(draft.slides[0].text).toContain('8');
    expect(draft.slides[0].background.color).toBe('#fff2cc');

    const image = draft.slides[0].elements.find((element) => element.kind === 'image');
    expect(image).toBeDefined();
    expect(image && image.kind === 'image' ? image.crop : null).toEqual({
      left: 0.1,
      top: 0.05,
      right: 0.1,
      bottom: 0.05,
    });
    expect(draft.assets).toHaveLength(1);
    expect(draft.assets[0].mimeType).toBe('image/png');
    expect(draft.assets[0].size).toBeGreaterThan(0);
    expect(draft.assets[0].blob.size).toBeGreaterThan(0);

    const table = draft.slides[0].elements.find((element) => element.kind === 'table');
    expect(table).toBeDefined();
    if (table && table.kind === 'table') {
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0][0].text).toBe('Phép nhân');
      expect(table.rows[1][1].text).toBe('8');
      expect(table.columnWidths).toEqual([0.5, 0.5]);
    }

    expect(draft.warnings.some((warning) => warning.code === 'chart_skipped')).toBe(true);
    expect(progress).toHaveBeenCalled();
    expect(progress.mock.calls.at(-1)?.[0]?.value).toBe(1);
    // The original file bytes are not part of the stored draft, only extracted images.
    expect(draft.assets.every((asset) => asset.partPath.startsWith('ppt/media/'))).toBe(true);
  });

  it('rejects files that are not PPTX packages', async () => {
    const zip = new JSZip();
    zip.file('not-a-presentation.txt', 'hello');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    await expect(parsePptxBuffer(buffer)).rejects.toMatchObject({
      name: 'PresentationParseError',
      code: 'invalid_pptx',
    });
  });

  it('rejects an empty buffer with a typed error', async () => {
    await expect(parsePptxBuffer(new ArrayBuffer(0))).rejects.toBeInstanceOf(PresentationParseError);
  });

  it('inherits placeholder geometry from the slide master when the layout omits it', async () => {
    const zip = new JSZip();
    zip.file(
      'ppt/presentation.xml',
      `<p:presentation ${NS}>
        <p:sldSz cx="12192000" cy="6858000"/>
        <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
      </p:presentation>`,
    );
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>`,
    );
    zip.file(
      'ppt/slides/slide1.xml',
      `<p:sld ${NS}><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:rPr sz="3600"/><a:t>Tổng quan bài học</a:t></a:r></a:p></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>Mục tiêu: hiểu khái niệm và vận dụng vào bài tập.</a:t></a:r></a:p></p:txBody></p:sp>
      </p:spTree></p:cSld></p:sld>`,
    );
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
      </Relationships>`,
    );
    zip.file(
      'ppt/slideLayouts/slideLayout1.xml',
      `<p:sldLayout ${NS}><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/></p:txBody></p:sp>
      </p:spTree></p:cSld></p:sldLayout>`,
    );
    zip.file(
      'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
      </Relationships>`,
    );
    zip.file(
      'ppt/slideMasters/slideMaster1.xml',
      `<p:sldMaster ${NS}><p:cSld><p:spTree>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="10058400" cy="1143000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></a:lstStyle></p:txBody></p:sp>
        <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="1800000"/><a:ext cx="10058400" cy="3200000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr sz="2200"/></a:lvl1pPr></a:lstStyle></p:txBody></p:sp>
      </p:spTree></p:cSld></p:sldMaster>`,
    );

    const draft = await parsePptxBuffer(await zip.generateAsync({ type: 'arraybuffer' }));

    expect(draft.slides).toHaveLength(1);
    expect(draft.slides[0].title).toBe('Tổng quan bài học');
    expect(draft.slides[0].text).toContain('Mục tiêu: hiểu khái niệm');
    expect(draft.slides[0].elements).toHaveLength(2);
    expect(draft.warnings.some((warning) => warning.code === 'empty_slides')).toBe(false);
    const body = draft.slides[0].elements.find(
      (element) => element.kind === 'text' && element.placeholderType === 'body',
    );
    expect(body && body.kind === 'text' ? body.height : 0).toBeGreaterThan(0);
  });
});
