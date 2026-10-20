declare module "imagetracerjs" {
  const ImageTracer: {
    imagedataToTracedata(imgd: ImageData, options?: Record<string, unknown>): unknown;
    getsvgstring(tracedata: unknown, options?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}
