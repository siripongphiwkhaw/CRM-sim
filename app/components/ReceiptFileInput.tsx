"use client";

import { useRef, useState } from "react";

const MAX_EDGE = 1600;

/**
 * File input for receipt photos. Downscales large photos to a ~1600px JPEG on
 * the client (phone photos are 3–8 MB; the server action caps uploads), shows
 * a preview, and swaps the processed file back into the input via DataTransfer
 * so a plain <form action={...}> submit carries the smaller image.
 */
export function ReceiptFileInput({ name = "receipt_image" }: { name?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      setInfo(null);
      return;
    }
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
            setPreview(URL.createObjectURL(blob));
            setInfo(`${Math.round(blob.size / 1024)} KB, ready to scan`);
            bitmap.close();
            return;
          }
        }
      }
      bitmap.close();
      setPreview(URL.createObjectURL(file));
      setInfo(`${Math.round(file.size / 1024)} KB, ready to scan`);
    } catch {
      // Not decodable client-side (rare) — let the server validate it.
      setPreview(null);
      setInfo("Ready to scan");
    }
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
        className="block w-full text-sm text-[#444] file:mr-3 file:cursor-pointer file:rounded file:border file:border-[#c9c9c9] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 file:transition file:duration-150 hover:file:bg-[#f3f3f3]"
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Receipt preview"
          className="max-h-56 rounded border border-[#e5e5e5] object-contain"
        />
      )}
      {info && <p className="text-xs text-[#706e6b]">{info}</p>}
    </div>
  );
}
