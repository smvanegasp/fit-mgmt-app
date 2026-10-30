import { Camera, CircleNotch } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { api, photoUrl, type Photo } from "../api";
import { PHOTO_SIDE, THUMB_SIDE, resizeImage } from "../lib/images";
import { BottomSheet } from "./BottomSheet";

/** Thumbnails; tap one to see it full size. */
export function PhotoStrip({ photos, onRemove, grid }: { photos: Photo[]; onRemove?: (photo: Photo) => void; grid?: boolean }) {
  const [open, setOpen] = useState<Photo | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className={grid ? "mt-2 grid grid-cols-3 gap-2" : "mt-2 flex gap-2 overflow-x-auto"}>
        {photos.map((p) => (
          <button key={p.key} type="button" onClick={() => setOpen(p)} className="shrink-0">
            <img src={photoUrl(p.key, "thumb")} alt={p.caption ?? "Photo"}
              className={grid ? "aspect-square w-full rounded-lg object-cover" : "size-16 rounded-lg object-cover"} />
          </button>
        ))}
      </div>
      {open && (
        <BottomSheet title={open.caption ?? "Photo"} onClose={() => setOpen(null)}>
          <img src={photoUrl(open.key)} alt={open.caption ?? "Photo"} className="w-full rounded-lg" />
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                onRemove(open);
                setOpen(null);
              }}
              className="mt-3 w-full rounded-xl border border-red-200 py-2.5 font-medium text-red-600"
            >
              Remove photo
            </button>
          )}
        </BottomSheet>
      )}
    </>
  );
}

/** Opens the camera (or library), resizes on the phone, uploads, hands back the key. */
export function PhotoButton({ onAdded, label = "Photo" }: { onAdded: (photo: Photo) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const [photo, thumb] = await Promise.all([resizeImage(file, PHOTO_SIDE), resizeImage(file, THUMB_SIDE)]);
      const { key } = await api.uploadPhoto(photo, thumb);
      onAdded({ key });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 active:bg-stone-100"
      >
        {busy ? <CircleNotch size={18} className="animate-spin" aria-hidden /> : <Camera size={18} weight="fill" aria-hidden />}
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
