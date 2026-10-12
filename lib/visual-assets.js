import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('./assets/',import.meta.url);
export function registerVisualAssets(ctx){
 const register=(directory,prefix='')=>{for(const f of readdirSync(directory,{withFileTypes:true})){if(f.isDirectory()){register(new URL(f.name+'/',directory),prefix+f.name+'/');continue}const name=prefix+f.name;if(!/\.(js|css|woff2)$/.test(name))continue;
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/plugins/dsh-generative-ui/assets/'+name,methods:['GET'],requestBody:'buffered',fetch:()=>new Response(readFileSync(new URL(f.name,directory)),{headers:{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'font/woff2','Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}})}));
 }};register(root);
}
