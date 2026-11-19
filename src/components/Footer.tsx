interface FooterProps {
  onNew: () => void;
}

const Dot = () => <span className="h-[3px] w-[3px] rounded-full bg-white/20" />;

export function Footer({ onNew }: FooterProps) {
  return (
    <footer className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[11px] text-slate-500 sm:gap-x-3 sm:text-xs">
      <span>四个数字各用一次</span>
      <Dot />
      <span>只用 + − × ÷ 与括号</span>
      <span className="hidden items-center gap-x-2.5 sm:flex">
        <Dot />
        <span>回车提交</span>
      </span>
      <button
        type="button"
        onClick={onNew}
        className="ml-auto select-none rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-neon/50 hover:text-neon sm:px-3 sm:text-xs"
      >
        换一题
      </button>
    </footer>
  );
}
