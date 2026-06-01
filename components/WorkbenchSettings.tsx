"use client";

interface Props {
  onOpenModels: () => void;
  onOpenSkills: () => void;
  skillsDisabled?: boolean;
}

export function WorkbenchSettings({ onOpenModels, onOpenSkills, skillsDisabled }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 py-5">
        <div className="mb-4 border-b border-border pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0] text-text-dim">Platform</div>
          <h1 className="m-0 mt-1 text-[22px] font-semibold tracking-[0] text-text">Settings</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={onOpenModels}
            className="rounded-[8px] border border-border bg-bg-panel p-4 text-left hover:bg-bg-hover"
          >
            <div className="text-[14px] font-semibold text-text">Models</div>
            <div className="mt-2 text-[12px] leading-5 text-text-muted">Provider keys, model list, defaults, and connection checks.</div>
          </button>
          <button
            onClick={onOpenSkills}
            disabled={skillsDisabled}
            className="rounded-[8px] border border-border bg-bg-panel p-4 text-left hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="text-[14px] font-semibold text-text">Skills</div>
            <div className="mt-2 text-[12px] leading-5 text-text-muted">Runtime tools and installed capabilities for the selected workspace.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
