import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/m4a',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('Fetching Google credentials for user:', user.id);

    // Get user's Google credentials
    const { data: credentials, error: credError } = await supabase
      .from('user_google_credentials')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (credError || !credentials) {
      console.error('No credentials found:', credError);
      throw new Error('Google Drive not connected');
    }

    let accessToken = credentials.access_token;
    const tokenExpiry = new Date(credentials.token_expiry);

    // Refresh token if expired
    if (tokenExpiry <= new Date()) {
      console.log('Token expired, refreshing...');
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: credentials.refresh_token!,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (!refreshResponse.ok) {
        console.error('Token refresh failed:', refreshData);
        throw new Error('Failed to refresh token');
      }

      accessToken = refreshData.access_token;

      // Update token in database
      await supabase
        .from('user_google_credentials')
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);

      console.log('Token refreshed successfully');
    }

    console.log('Fetching audio files from Google Drive...');

    // Fetch audio files from Google Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `(${AUDIO_MIME_TYPES.map(type => `mimeType='${type}'`).join(' or ')}) and trashed=false`
      )}&fields=files(id,name,mimeType,size,webContentLink)&pageSize=1000`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!driveResponse.ok) {
      const error = await driveResponse.text();
      console.error('Drive API error:', error);
      throw new Error('Failed to fetch files from Google Drive');
    }

    const driveData = await driveResponse.json();
    console.log(`Found ${driveData.files?.length || 0} audio files`);

    const songs = driveData.files.map((file: any) => ({
      id: file.id,
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      artist: 'אמן לא ידוע',
      album: 'אלבום לא ידוע',
      duration: 0, // We don't have duration from Drive API
      url: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }));

    return new Response(
      JSON.stringify({ songs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in google-drive-files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
