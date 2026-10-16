import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui, 21st.dev 컴포넌트가 공통으로 쓰는 클래스 합치기 도우미. 지우지 마세요. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
