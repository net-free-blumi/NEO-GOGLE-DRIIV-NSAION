import { useState, useEffect, useRef } from "react";
import { Cast, Loader2, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useChromecastContext } from "@/contexts/ChromecastContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface ChromecastDeviceListProps {
  onDeviceSelect?: (deviceId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ChromecastDeviceList = ({ 
  onDeviceSelect, 
  isOpen: controlledOpen,
  onOpenChange: controlledOnOpenChange 
}: ChromecastDeviceListProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const chromecast = useChromecastContext();
  const { toast } = useToast();
  const castButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  useEffect(() => {
    if (isOpen) {
      scanForDevices();
    }
  }, [isOpen]);

  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      // Use Chromecast SDK to discover devices
      const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
      if (!ctx) {
        toast({
          title: "Chromecast לא זמין",
          description: "ודא שהדפדפן תומך ב-Chromecast",
          variant: "destructive",
        });
        setIsScanning(false);
        return;
      }

      // Check if Cast is available
      const castState = ctx.getCastState();
      const CastState = (window as any).cast?.framework?.CastState;
      
      if (castState === CastState.NO_DEVICES_AVAILABLE) {
        setDevices([]);
        toast({
          title: "לא נמצאו מכשירים",
          description: "ודא שהמכשירים באותה רשת WiFi",
          variant: "destructive",
        });
        setIsScanning(false);
        return;
      }

      // If there's an active session, show the connected device
      const session = ctx.getCurrentSession();
      if (session) {
        const receiver = session.getReceiver();
        setDevices([{
          id: receiver.friendlyName || 'chromecast-connected',
          name: receiver.friendlyName || 'Chromecast',
          friendlyName: receiver.friendlyName,
          isConnected: true,
        }]);
        setIsScanning(false);
        return;
      }

      // Listen for Cast state changes to detect when devices are available
      const onCastStateChanged = (e: any) => {
        if (e.castState === CastState.NO_DEVICES_AVAILABLE) {
          setDevices([]);
        } else if (e.castState === CastState.NOT_CONNECTED) {
          // Devices are available but not connected
          setDevices([{
            id: 'chromecast-available',
            name: 'Chromecast / Google Cast',
            isConnected: false,
          }]);
        } else if (e.castState === CastState.CONNECTED) {
          // Connected to a device
          const session = ctx.getCurrentSession();
          if (session) {
            const receiver = session.getReceiver();
            setDevices([{
              id: receiver.friendlyName || 'chromecast-connected',
              name: receiver.friendlyName || 'Chromecast',
              friendlyName: receiver.friendlyName,
              isConnected: true,
            }]);
          }
        }
        setIsScanning(false);
      };

      // Initial check
      if (castState === CastState.NOT_CONNECTED || castState === CastState.CONNECTING) {
        // Devices are available
        setDevices([{
          id: 'chromecast-available',
          name: 'Chromecast / Google Cast',
          isConnected: false,
        }]);
        setIsScanning(false);
      } else if (castState === CastState.CONNECTED) {
        // Already connected
        const session = ctx.getCurrentSession();
        if (session) {
          const receiver = session.getReceiver();
          setDevices([{
            id: receiver.friendlyName || 'chromecast-connected',
            name: receiver.friendlyName || 'Chromecast',
            friendlyName: receiver.friendlyName,
            isConnected: true,
          }]);
        }
        setIsScanning(false);
      } else {
        // No devices available
        setDevices([]);
        setIsScanning(false);
      }

      ctx.addEventListener(
        (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onCastStateChanged
      );

      // Clean up
      return () => {
        ctx.removeEventListener(
          (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          onCastStateChanged
        );
      };
    } catch (error) {
      console.error('Error scanning for devices:', error);
      toast({
        title: "שגיאה בסריקה",
        description: "לא ניתן לסרוק אחר מכשירים",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const handleDeviceSelect = async (device: any) => {
    if (device.isConnected) {
      // Already connected
      onDeviceSelect?.(device.id);
      setIsOpen(false);
      return;
    }

    // Connect to device - this will show the native picker
    // But we'll handle it gracefully
    try {
      setIsScanning(true);
      const connected = await chromecast.connect();
      if (connected) {
        toast({
          title: "מחובר",
          description: `מחובר ל-${chromecast.state.device?.name || 'Chromecast'}`,
        });
        onDeviceSelect?.(chromecast.state.device?.id || device.id);
        setIsOpen(false);
        // Refresh device list
        setTimeout(() => scanForDevices(), 500);
      } else {
        // User cancelled or connection failed
        setIsScanning(false);
      }
    } catch (error: any) {
      // User cancelled - don't show error
      if (error.code !== 'cancel' && error.name !== 'AbortError') {
        toast({
          title: "שגיאה",
          description: error.message || "לא ניתן להתחבר למכשיר",
          variant: "destructive",
        });
      }
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>בחר רמקול Chromecast</DialogTitle>
          <DialogDescription>
            בחר רמקול מהרשימה להזרמת מוזיקה
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 mt-4">
          {isScanning ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">סורק אחר מכשירים...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <WifiOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                לא נמצאו מכשירים
                <br />
                ודא שהמכשירים באותה רשת WiFi
              </p>
            </div>
          ) : (
            devices.map((device) => (
              <Button
                key={device.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleDeviceSelect(device)}
              >
                <Cast className="w-5 h-5 text-primary" />
                <div className="flex-1 text-right">
                  <div className="font-medium">{device.name}</div>
                  {device.friendlyName && device.friendlyName !== device.name && (
                    <div className="text-xs text-muted-foreground">{device.friendlyName}</div>
                  )}
                </div>
                {device.isConnected && (
                  <Badge variant="secondary" className="mr-auto">
                    מחובר
                  </Badge>
                )}
              </Button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            ביטול
          </Button>
          <Button onClick={scanForDevices} disabled={isScanning}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            רענון
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChromecastDeviceList;

