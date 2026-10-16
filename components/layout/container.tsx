import { cn } from "@/lib/utils";

/** 내용 폭을 제한하고 좌우 여백을 주는 상자. 사이트 전체 최대 폭은 여기 max-w-6xl 로 조절. */
export function Container({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)} {...props} />;
}
