import { Badge } from "@/components/ui/badge";

const VERSION = "3.5.0"; // עדכן את זה בכל שינוי משמעותי

export const VersionBadge = () => {
  return (
    <div className="fixed bottom-2 left-2 z-50">
      <Badge 
        variant="secondary" 
        className="text-xs px-2 py-1 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm"
      >
        v{VERSION}
      </Badge>
    </div>
  );
};

export default VersionBadge;

