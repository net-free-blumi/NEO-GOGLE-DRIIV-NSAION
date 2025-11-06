import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";

interface SettingsMenuProps {
  onLogout: () => void;
  isLoggedIn: boolean;
}

export default function SettingsMenu({ onLogout, isLoggedIn }: SettingsMenuProps) {
  if (!isLoggedIn) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>הגדרות</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> התנתק מ-Google
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


