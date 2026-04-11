import { UserButton } from "@/components/auth/user-button";
import { ChatContainer } from "@/components/chat/chat-container";

export default function ChatPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-safe pt-safe backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                SEACE
              </span>
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                Chat
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Contrataciones publicas y cotizaciones
            </p>
          </div>
          <div className="shrink-0">
            <UserButton />
          </div>
        </div>
      </header>
      <ChatContainer />
    </div>
  );
}
