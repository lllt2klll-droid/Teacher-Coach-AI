declare module 'mammoth/mammoth.browser' {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    extractRawText(input: MammothInput): Promise<MammothResult>;
    convertToHtml(input: MammothInput): Promise<MammothResult>;
  };
  export default mammoth;
}
