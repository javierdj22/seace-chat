"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

export function UserButton() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session?.user) return null;

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-9">
        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium hidden sm:inline">
        {session.user.name}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full"
        onClick={async () => {
          await signOut();
          router.push("/login");
        }}
      >
        <LogOut className="size-3.5" />
      </Button>
    </div>
  );
}
