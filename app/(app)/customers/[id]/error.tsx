"use client";

import { useEffect } from "react";
import { Card, LinkButton } from "@/app/components/ui";

export default function CustomerError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-12 max-w-md text-center">
      <p className="text-lg font-semibold text-[#14202b]">Something went wrong</p>
      <p className="mt-1 text-sm text-[#607785]">
        We couldn&apos;t load this customer. Try again, or head back to home.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full border border-[#c2d0d6] bg-white px-4 py-2 text-sm text-brand-600 hover:bg-[#eef3f5]"
        >
          Try again
        </button>
        <LinkButton href="/">Go to home</LinkButton>
      </div>
    </Card>
  );
}
