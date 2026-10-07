const root=import.meta.dir;
Bun.serve({
  port:Number(Bun.env.PORT||3000),
  async fetch(req){
    const u=new URL(req.url);
    let p=decodeURIComponent(u.pathname);

    // Token routes: /1, /2, /3 (architecture extends to /3072).
    const tokenMatch=p.match(/^\/(\d+)\/?$/);
    if(tokenMatch){
      const token=Number(tokenMatch[1]);
      if(token>=1&&token<=3){
        const html=await Bun.file(root+"/index.html").text();
        const routed=html.replace(
          "<head>",
          `<head><script>history.replaceState(null,"","/?token=${token}");</script>`
        );
        return new Response(routed,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
      }
      return new Response("Token not found",{status:404,headers:{"content-type":"text/plain; charset=utf-8"}});
    }

    if(p==="/")p="/index.html";
    if(p.includes(".."))return new Response("bad",{status:400});
    const f=Bun.file(root+p);
    if(!(await f.exists()))return new Response("not found",{status:404});
    return new Response(f,{headers:{"cache-control":"no-store"}});
  }
});