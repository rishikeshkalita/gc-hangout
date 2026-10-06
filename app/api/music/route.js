import { NextResponse } from "next/server";

export async function GET(request){
  const clientId=process.env.JAMENDO_CLIENT_ID;
  if(!clientId){
    return NextResponse.json({configured:false,tracks:[],error:"JAMENDO_CLIENT_ID is not configured."},{status:503});
  }
  const query=request.nextUrl.searchParams.get("search")||"instrumental lounge";
  const url=new URL("https://api.jamendo.com/v3.0/tracks/");
  url.searchParams.set("client_id",clientId);
  url.searchParams.set("format","json");
  url.searchParams.set("limit","12");
  url.searchParams.set("audioformat","mp32");
  url.searchParams.set("imagesize","200");
  url.searchParams.set("search",query.slice(0,80));
  url.searchParams.set("include","licenses");
  try{
    const response=await fetch(url,{next:{revalidate:300}});
    if(!response.ok)throw new Error("Jamendo request failed: "+response.status);
    const data=await response.json();
    const tracks=(data.results||[]).filter(t=>t.audio).map(t=>({
      id:String(t.id),title:t.name,artist:t.artist_name||"Unknown artist",
      album:t.album_name||"Jamendo",image:t.album_image||t.image||"",
      audio:t.audio,duration:Number(t.duration||0),
      license:t.license_ccurl||t.license||""
    }));
    return NextResponse.json({configured:true,tracks});
  }catch(error){
    console.error("Jamendo API error",error);
    return NextResponse.json({configured:true,tracks:[],error:"Music catalog is temporarily unavailable."},{status:502});
  }
}
