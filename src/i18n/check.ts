/**
 * Compile-time guard: fails `tsc` if en.json is missing any key (or has a
 * different shape) compared with el.json. Never imported at runtime.
 */
import type el from "@/messages/el.json";
import type en from "@/messages/en.json";

type Shape<T> = T extends string
  ? string
  : T extends Array<infer U>
    ? Array<Shape<U>>
    : T extends object
      ? { [K in keyof T]: Shape<T[K]> }
      : T;

type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const messagesMatch: AssertEqual<Shape<typeof el>, Shape<typeof en>> = true;
