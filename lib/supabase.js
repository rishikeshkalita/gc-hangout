import { createClient } from "@supabase/supabase-js";

let client;

export async function getSupabase(){
  if(client)return client;
  if(typeof window==="undefined")return null;

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;

  client=createClient(url,key,{
    auth:{
      autoRefreshToken:true,
      persistSession:true,
      detectSessionInUrl:false,
    },
  });
  return client;
}

export async function ensureAnonymousSession(supabase, metadata={}){
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user?.id)return session;

  const {data,error}=await supabase.auth.signInAnonymously({
    options:{data:metadata},
  });
  if(error)throw error;
  if(!data?.session?.user?.id)throw new Error("Anonymous multiplayer sign-in did not return a session.");
  return data.session;
}
