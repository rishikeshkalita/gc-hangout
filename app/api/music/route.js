import { NextResponse } from "next/server";
import { normalizeMusicResponse } from "../../../lib/game-state.mjs";

const MAX_QUERIES = 3;

export async function GET(request){
  const clientId=process.env.JAMENDO_CLIENT_ID;
  if(!clientId){
    console.error("Music catalog not configured: JAMENDO_CLIENT_ID is missing.");
    return NextResponse.json({configured:false,tracks:[],error:"Music API is not configured."},{status:503});
  }

  const query=(request.nextUrl.searchParams.get("search")||"instrumental lounge").slice(0,80);
  const fetchTracks=async(params,label)=>{
    const url=new URL("https://api.jamendo.com/v3.0/tracks/");
    url.searchParams.set("client_id",clientId);
    url.searchParams.set("format","json");
    url.searchParams.set("limit","12");
    url.searchParams.set("audioformat","mp31");
    url.searchParams.set("imagesize","200");
    url.searchParams.set("include","licenses");
    url.searchParams.set("groupby","artist_id");
    if(params.search)url.searchParams.set("search",params.search);
    if(params.tags)url.searchParams.set("tags",params.tags);
    if(params.featured)url.searchParams.set("featured",params.featured);

    const response=await fetch(url,{next:{revalidate:300}});
    const data=await response.json().catch(()=>({}));
    const rawCount=Array.isArray(data.results)?data.results.length:0;
    const playableCount=normalizeMusicResponse(data).length;
    console.info("Music catalog probe",{
      strategy:label,
      query:params.search||null,
      tags:params.tags||null,
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

  // Controlled fallback: one requested search, then two documented Jamendo
  // featured-tag searches. This avoids a request storm while covering the
  // known empty free-text-search failure mode.
  const strategies=[
    {label:"requested-search",search:query},
    {label:"featured-lounge",tags:"lounge",featured:"1"},
    {label:"featured-chillout",tags:"chillout",featured:"1"}
  ];

  try{
    let lastData={results:[]};
    for(const strategy of strategies.slice(0,MAX_QUERIES)){
      lastData=await fetchTracks(strategy,strategy.label);
      const tracks=normalizeMusicResponse(lastData);
      if(tracks.length){
        return NextResponse.json({configured:true,tracks,diagnostics:{strategy:strategy.label,attempts:strategies.indexOf(strategy)+1}});
      }
    }

    return NextResponse.json({
      configured:true,
      tracks:[],
      diagnostics:{strategy:"exhausted",attempts:Math.min(strategies.length,MAX_QUERIES)}
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
