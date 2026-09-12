import { Card, LinkButton } from "@/app/components/ui";

export default function CustomerNotFound() {
  return (
    <Card className="mx-auto mt-12 max-w-md text-center">
      <p className="text-lg font-semibold text-[#14202b]">Customer not found</p>
      <p className="mt-1 text-sm text-[#607785]">
        This customer doesn&apos;t exist, was deleted, or is outside your department&apos;s scope.
      </p>
      <div className="mt-4 flex justify-center">
        <LinkButton href="/">Go to home</LinkButton>
      </div>
    </Card>
  );
}
