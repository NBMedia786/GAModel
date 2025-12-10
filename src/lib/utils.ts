import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  '#EF4444', // Red 500
  '#F97316', // Orange 500
  '#F59E0B', // Amber 500
  '#10B981', // Emerald 500
  '#3B82F6', // Blue 500
  '#6366F1', // Indigo 500
  '#8B5CF6', // Violet 500
  '#EC4899', // Pink 500
];

export function getUserColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}
