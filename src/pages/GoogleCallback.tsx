import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
const GDRIVE_FOLDER_ID = import.meta.env.VITE_GDRIVE_FOLDER_ID || "";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

const LS = {
  codeVerifier: "oauth_code_verifier",
  accessToken: "gd_access_token",
  tokenExpiresAt: "gd_token_expires_at",
  songs: "gd_songs",
};

async function loadSongsFromDrive(accessToken: string): Promise<any[]> {
  if (!GDRIVE_FOLDER_ID) throw new Error("Missing VITE_GDRIVE_FOLDER_ID in environment");
  
  const q = `'${GDRIVE_FOLDER_ID}' in parents and trashed = false and mimeType contains 'audio/'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=name&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  
  const filesRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!filesRes.ok) {
    const errorData = await filesRes.json().catch(() => ({}));
    throw new Error(`Failed to list Drive files: ${errorData.error?.message || filesRes.statusText}`);
  }
  
  const filesData = await filesRes.json();
  const files = (filesData.files || []) as { id: string; name: string; mimeType?: string }[];
  
  const isNetlify = window.location.hostname.includes('netlify.app');
  const proxyBase = isNetlify 
    ? `${window.location.origin}/.netlify/functions/stream`
    : `http://${window.location.hostname}:3001/api/stream`;
  
  const songs = files.map((f) => ({
    id: f.id,
    title: f.name,
    artist: "",
    duration: 0,
    url: isNetlify 
      ? `${proxyBase}/${encodeURIComponent(f.id)}`
      : `${proxyBase}/${encodeURIComponent(f.id)}?token=${encodeURIComponent(accessToken)}`,
  }));
  
  return songs;
}

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          console.error('OAuth error:', error);
          setStatus('error');
          setErrorMessage(error === 'access_denied' ? 'ההרשאה נדחתה' : 'שגיאה בהתחברות');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (!code) {
          setStatus('error');
          setErrorMessage('לא נמצא קוד הרשאה');
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        // Get code verifier from sessionStorage
        const codeVerifier = sessionStorage.getItem(LS.codeVerifier);
        if (!codeVerifier) {
          throw new Error('Missing code verifier');
        }

        // Exchange code for tokens
        const body = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        });

        const tokenRes = await fetch(OAUTH_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        if (!tokenRes.ok) {
          const errorData = await tokenRes.json().catch(() => ({}));
          throw new Error(errorData.error_description || 'Token exchange failed');
        }

        const tokens = await tokenRes.json();
        const accessToken = tokens.access_token as string;
        const expiresIn = tokens.expires_in || 3600;
        const expiresAt = Date.now() + (expiresIn - 60) * 1000;

        // Store tokens
        sessionStorage.setItem(LS.accessToken, accessToken);
        sessionStorage.setItem(LS.tokenExpiresAt, expiresAt.toString());
        sessionStorage.removeItem(LS.codeVerifier);

        // Load songs from Drive
        const songs = await loadSongsFromDrive(accessToken);
        sessionStorage.setItem(LS.songs, JSON.stringify(songs));

        setStatus('success');
        toast({
          title: 'התחברות הצליחה!',
          description: `נמצאו ${songs.length} שירים ב-Google Drive`,
        });

        // Redirect to home after short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'שגיאה לא ידועה');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">מתחבר ל-Google Drive...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg text-foreground font-semibold">התחברות הצליחה!</p>
            <p className="text-sm text-muted-foreground">מעביר אותך לדף הבית...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-lg text-foreground font-semibold">שגיאה בהתחברות</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <p className="text-xs text-muted-foreground mt-2">מעביר אותך לדף הבית...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;
