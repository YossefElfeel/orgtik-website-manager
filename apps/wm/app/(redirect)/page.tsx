import { redirect } from "next/navigation";

// The proxy sends / to the visitor's language; this is only a fallback.
export default function Root() {
  redirect("/en");
}
