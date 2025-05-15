import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User } from "firebase/auth";
import Link from "next/link";
import { Menu, Moon, Sun, LogOut } from "lucide-react";
import React from "react";

interface TopBarProps {
  user: User | null;
  authLoading: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onSignOut: () => Promise<void>;
  isSidebarOpen: boolean;
}

function TopBar({ 
  user, 
  authLoading, 
  theme, 
  onToggleTheme, 
  onToggleSidebar,
  onSignOut 
}: TopBarProps) {
  return (
    <header className="w-full h-16 flex items-center justify-between px-2 sm:px-4 md:px-6 bg-background border-b border-border shadow-sm fixed top-0 left-0 z-30">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-bold text-base sm:text-lg tracking-tight">PromptTune</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Toggle */}
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        {/* User Section */}
        {authLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
              <AvatarImage 
                src={user.photoURL || undefined} 
                alt={user.displayName || user.email || "User"} 
              />
              <AvatarFallback>
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        ) : (
          <Link href="/login">
            <Button variant="default" className="h-8 sm:h-9 px-3 sm:px-4 text-sm sm:text-base">
              Login / Sign Up
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

export default React.memo(TopBar); 