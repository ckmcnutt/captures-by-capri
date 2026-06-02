import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a Supabase signed storage URL to a resized/compressed thumbnail
 * using Supabase's built-in image transformation API.
 * Swaps /object/sign/ → /render/image/sign/ and appends width + quality params.
 */
export function toThumbnailUrl(url: string, width: number, quality = 75): string {
  return url
    .replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/")
    + `&width=${width}&quality=${quality}`;
}

export function getSeason() {
  const month = new Date().getMonth(); // Returns 0-11
  
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  
  return 'Winter'; // Dec, Jan, Feb
}
