import { notFound } from "next/navigation";

/** Any unknown path under a locale renders the localised, branded 404. */
export default function CatchAll() {
  notFound();
}
