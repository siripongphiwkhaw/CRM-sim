"use client";

import { signOutMemberAction } from "../actions";
import { LiffButton } from "../components/LiffButton";

export function SignOutButton() {
  return (
    <form action={signOutMemberAction}>
      <LiffButton variant="secondary">Sign out</LiffButton>
    </form>
  );
}
