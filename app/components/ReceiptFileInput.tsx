"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 1600;

/**
 * File input for receipt photos. Downscales large photos to a ~1600px JPEG on
 * the client, shows a preview, and swaps the processed file back into the
 * input via DataTransfer so a plain <form action={...}> submit carries the
 * smaller image.
 *
 * With `localOcr` (the default, key-free path) it also reads the receipt in
 * the browser with Tesseract (Thai + English) and posts the recognized text
 * in a hidden `ocr_text` field — the server then parses that text instead of
 * calling a paid vision API.
 */
export function ReceiptFileInput({
  name = "receipt_image",
  localOcr = false,
  onBusyChange,
}: {
  name?: string;
  localOcr?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const jobRef = useRef(0);

  async function runLocalOcr(image: Blob) {
    const job = ++jobRef.current;
    onBusyChange?.(true);
    setOcrText("");
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+tha", 1, {
        logger: (m) => {
          if (jobRef.current === job && m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const result = await worker.recognize(image);
      await worker.terminate();
      if (jobRef.current !== job) return; // a newer file was chosen
      setOcrText(result.data.text);
      setProgress(null);
      setInfo("Receipt read — press the scan button to verify it.");
    } catch {
      if (jobRef.current !== job) return;
      setProgress(null);
      setInfo(
        "Could not read the receipt in this browser. Check your connection (the reader downloads Thai/English language data on first use) and try again."
      );
    } finally {
      if (jobRef.current === job) onBusyChange?.(false);
    }
  }

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      setInfo(null);
      setOcrText("");
      return;
    }
    let toScan: Blob = file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale < 1 || file.size > 1024 * 1024) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.85)
          );
          if (blob && inputRef.current) {
            const processed = new File([blob], "receipt.jpg", { type: "image/jpeg" });
            const dt = new DataTransfer();
            dt.items.add(processed);
            inputRef.current.files = dt.files;
            toScan = blob;
          }
        }
      }
      bitmap.close();
      setPreview(URL.createObjectURL(toScan));
      setInfo(`${Math.round(toScan.size / 1024)} KB`);
    } catch {
      // Not decodable client-side (rare) — let the server handle the original.
      setPreview(null);
      setInfo("Ready");
    }
    if (localOcr) await runLocalOcr(toScan);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="block w-full text-sm text-[#3c4f5e] file:mr-3 file:cursor-pointer file:rounded file:border file:border-[#c2d0d6] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 file:transition file:duration-150 hover:file:bg-[#eef3f5]"
      />
      {localOcr && <input type="hidden" name="ocr_text" value={ocrText} />}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Receipt preview"
          className="max-h-56 rounded border border-[#dde5e8] object-contain"
        />
      )}
      {progress !== null && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-[#607785]">
            <span>Reading receipt in your browser…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-[#eef3f5]">
            <div
              className="h-full rounded-sm bg-brand-600 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {info && progress === null && <p className="text-xs text-[#607785]">{info}</p>}
    </div>
  );
}
