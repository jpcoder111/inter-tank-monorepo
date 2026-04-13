"use client";

import { diffLines } from "diff";

interface PromptDiffProps {
  oldText: string;
  newText: string;
}

export default function PromptDiff({ oldText, newText }: PromptDiffProps) {
  const changes = diffLines(oldText, newText);

  return (
    <pre className="flex-1 border border-gray-200 rounded-md p-3 font-mono text-sm overflow-y-scroll whitespace-pre-wrap m-0 bg-gray-50">
      {changes.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? "bg-green-100 text-green-800"
              : part.removed
                ? "bg-red-100 text-red-800 line-through"
                : ""
          }
        >
          {part.value}
        </span>
      ))}
    </pre>
  );
}
