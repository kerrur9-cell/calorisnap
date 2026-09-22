import { redirect } from "next/navigation";

/** Compatibility redirect for phones that still have the former tab cached. */
export default function LegacyWaterPage() {
  redirect("/hub");
}
