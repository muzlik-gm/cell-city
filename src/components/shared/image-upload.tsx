"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
  kind?: string;
}

export function ImageUpload({ value, onChange, label = "Upload image", className, kind }: ImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  return (
    <div className={cn("w-full", className)}>
      {value ? (
        <div className="group relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
          { }
          <img src={value} alt={label} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white/20 p-2 text-white backdrop-blur hover:bg-white/30"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg bg-white/20 p-2 text-white backdrop-blur hover:bg-rose-500/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) upload(file);
          }}
          className={cn(
            "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition hover:border-primary/40 hover:bg-muted/50",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-soft">
                <ImageIcon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[10px] text-muted-foreground/70">Click or drag</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// Gallery of multiple images
export function ImageGalleryUpload({
  images,
  onChange,
  max = 8,
}: {
  images: { url: string; kind?: string }[];
  onChange: (imgs: { url: string; kind?: string }[]) => void;
  max?: number;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange([...images, { url: data.url, kind: "OTHER" }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((img, i) => (
        <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
          { }
          <img src={img.url} alt={`image-${i}`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(images.filter((_, idx) => idx !== i))}
            className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-500"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {images.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted/30 text-muted-foreground transition hover:border-primary/40 hover:bg-muted/50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4" />}
          <span className="text-[10px] font-medium">Add</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          files.slice(0, max - images.length).forEach(upload);
          e.target.value = "";
        }}
      />
    </div>
  );
}
