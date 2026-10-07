const root=import.meta.dir;
let revealed=false;
const seenAssets=["","/assets/a3.jpg","/assets/a5.jpg","/assets/a7.jpg"];
Bun.serve({
 port:Number(Bun.env.PORT||3000),
 async fetch(req){
  const u=new URL(req.url); let p=decodeURIComponent(u.pathname);

  if(p==="/reveal-status") return Response.json({revealed},{headers:{"cache-control":"no-store"}});
  if(p==="/trigger-reveal"&&req.method==="POST"){revealed=true;return Response.json({revealed:true},{headers:{"cache-control":"no-store"}});}
  if(p==="/reset-reveal"&&req.method==="POST"){revealed=false;return Response.json({revealed:false},{headers:{"cache-control":"no-store"}});}

  const ra=p.match(/^\/reveal-art\/(\d+)$/);
  if(ra){
   const n=Number(ra[1]);
   if(!revealed)return new Response("Not revealed",{status:403,headers:{"cache-control":"no-store"}});
   if(n<1||n>3)return new Response("Token not found",{status:404});
   const f=Bun.file(root+seenAssets[n]);
   return new Response(f,{headers:{"content-type":"image/jpeg","cache-control":"no-store"}});
  }

  const revealRoute=p.match(/^\/reveal\/(\d+)\/?$/);
  if(revealRoute){
   const token=Number(revealRoute[1]);
   if(token>=1&&token<=3){
    const html=await Bun.file(root+"/reveal.html").text();
    const routed=html.replace("<head>",`<head><script>history.replaceState(null,"","/reveal/${token}?token=${token}");</script>`);
    return new Response(routed,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
   }
   return new Response("Token not found",{status:404});
  }

  const tokenMatch=p.match(/^\/(\d+)\/?$/);
  if(tokenMatch){
   const token=Number(tokenMatch[1]);
   if(token>=1&&token<=3){
    const html=await Bun.file(root+"/index.html").text();
    const routed=html.replace("<head>",`<head><script>history.replaceState(null,"","/?token=${token}");</script>`);
    return new Response(routed,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
   }
   return new Response("Token not found",{status:404});
  }

  if(p==="/")p="/index.html";
  if(p.includes(".."))return new Response("bad",{status:400});
  const f=Bun.file(root+p);
  if(!(await f.exists()))return new Response("not found",{status:404});
  return new Response(f,{headers:{"cache-control":"no-store"}});
 }
});