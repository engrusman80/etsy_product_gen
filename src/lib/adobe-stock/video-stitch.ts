// Browser-only helpers for chaining Veo clips into a long-form video.
// - extractLastFrame: grabs the final frame of an MP4 blob as a JPEG (base64, no prefix).
// - concatMp4: stitches multiple MP4 blobs into one using ffmpeg.wasm.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;

async function getFfmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));
  // UMD core hosted on unpkg — small (~25 MB) and cached after first load.
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ff.load({
    coreURL: `${baseURL}/ffmpeg-core.js`,
    wasmURL: `${baseURL}/ffmpeg-core.wasm`,
  });
  ffmpegInstance = ff;
  return ff;
}

export async function extractLastFrame(videoBlob: Blob): Promise<{ base64: string; mime: string }> {
  const url = URL.createObjectURL(videoBlob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video to extract frame"));
    });
    // Seek to ~last frame (slightly before end to avoid black frame)
    const t = Math.max(0, video.duration - 0.1);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Seek failed"));
      video.currentTime = t;
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1];
    return { base64, mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function concatMp4(blobs: Blob[], onProgress?: (msg: string) => void): Promise<Blob> {
  if (blobs.length === 1) return blobs[0];
  const ff = await getFfmpeg(onProgress);
  const names: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const name = `clip_${i}.mp4`;
    await ff.writeFile(name, await fetchFile(blobs[i]));
    names.push(name);
  }
  const listTxt = names.map((n) => `file '${n}'`).join("\n");
  await ff.writeFile("list.txt", new TextEncoder().encode(listTxt));

  // Try stream-copy concat first (fast, lossless). If it fails (mismatched
  // SPS/PPS between clips), fall back to re-encoding.
  onProgress?.("Stitching clips...");
  try {
    await ff.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "out.mp4"]);
  } catch {
    onProgress?.("Re-encoding for smooth join...");
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "list.txt",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "out.mp4",
    ]);
  }
  const data = await ff.readFile("out.mp4");
  // Cleanup
  for (const n of names) await ff.deleteFile(n).catch(() => {});
  await ff.deleteFile("list.txt").catch(() => {});
  await ff.deleteFile("out.mp4").catch(() => {});
  const u8 = data as Uint8Array;
  return new Blob([u8.buffer as ArrayBuffer], { type: "video/mp4" });
}
