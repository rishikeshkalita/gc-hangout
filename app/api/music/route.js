import { NextResponse } from "next/server";
import { normalizeMusicResponse } from "../../../lib/game-state.mjs";

const MAX_QUERIES = 2;

export async function GET(request){
  // Jamendo documents a read-only test client for quick API checks. Production still
  // prefers the project's configured client; preview deployments can therefore play
  // catalog music without silently disabling the feature when preview env scoping is missing.
  const clientId=process.env.JAMENDO_CLIENT_ID||"709fa152";

  const query=(request.nextUrl.searchParams.get("search")||"lounge").slice(0,80);

  const fetchTracks=async(search,label)=>{
    const url=new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("format","json");
    url.searchParams.set("limit","12");
    url.searchParams.set("audioformat","mp32");
    url.searchParams.set("imagesize","200");
    url.searchParams.set("include","licenses");
    url.searchParams.set("search",search);

    const response=await fetch(url,{next:{revalidate:300}});
    const data=await response.json().catch(()=>({}));
    const rawCount=Array.isArray(data.results)?data.results.length:0;
    const playableCount=normalizeMusicResponse(data).length;

    console.info("Music catalog probe",{
      strategy:label,
      query:search,
      status:response.status,
      rawCount,
      playableCount,
      apiStatus:data?.headers?.status||null,
      apiCode:data?.headers?.code??null,
      apiError:data?.headers?.error_message||null
    });

    if(!response.ok){
      const error=new Error("Jamendo request failed: "+response.status);
      error.status=response.status;
      throw error;
    }
    return data;
  };

  // The production investigation showed the combined free-text query
  // "instrumental lounge" returns zero rows for this valid client, while
  // "lounge" returns real playable Jamendo tracks. Keep this fallback
  // deliberately small and observable rather than issuing a request storm.
  const searches=[
    {value:query,label:"requested-search"},
    ...(query.toLowerCase()!=="lounge"?[{value:"lounge",label:"known-good-lounge-fallback"}]:[])
  ];

  try{
    for(const [index,strategy] of searches.slice(0,MAX_QUERIES).entries()){
      const data=await fetchTracks(strategy.value,strategy.label);
      const tracks=normalizeMusicResponse(data);
      if(tracks.length){
        return NextResponse.json({
          configured:true,
          tracks,
          diagnostics:{strategy:strategy.label,attempts:index+1}
        });
      }
    }

    return NextResponse.json({
      configured:true,
      tracks:[],
      diagnostics:{strategy:"exhausted",attempts:searches.length}
    });
  }catch(error){
    console.error("Jamendo API error",{
      status:error?.status||502,
      message:error?.message||String(error)
    });
    return NextResponse.json({
      configured:true,
      tracks:[],
      error:"Music API request failed. Check server logs for the provider status."
    },{status:502});
  }
}
