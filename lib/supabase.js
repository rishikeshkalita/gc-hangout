let client=null;
let clientPromise=null;

export async function getSupabase(){
  if(typeof window==="undefined")return null;
  if(client)return client;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  if(!clientPromise){
    clientPromise=import("@supabase/supabase-js").then(({createClient})=>{
      client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
      return client;
    });
  }
  return clientPromise;
}
