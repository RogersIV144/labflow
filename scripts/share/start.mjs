import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';

if(Number(process.versions.node.split('.')[0])<22){console.error('需要 Node.js 22 或更新版本：https://nodejs.org/en/download');process.exit(1);}
const root=dirname(fileURLToPath(import.meta.url));
process.chdir(root);
async function free(port){return new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
let port=Number(process.env.PORT||4317);
while(!(await free(port))){if(process.env.PORT||port>=4327){console.error('端口被占用。关闭旧的 LabFlow 窗口后再启动，或设置 PORT。');process.exit(1);}port++;}
process.env.PORT=String(port);
process.argv.push('--production');
await import('./server/app.mjs');
const url=`http://127.0.0.1:${port}`;
await mkdir(join(root,'.labflow'),{recursive:true});
await writeFile(join(root,'.labflow','instance.json'),JSON.stringify({url}),{mode:0o600});
const config={mcpServers:{labflow:{command:process.execPath,args:[join(root,'server','mcp.mjs')],env:{LABFLOW_URL:url,LABFLOW_PROJECT_DIR:root}}}};
await writeFile(join(root,'agent-mcp-config.json'),JSON.stringify(config,null,2)+'\n');
console.log('\nLabFlow 已启动：'+url+'\n请保持此窗口打开，结束时按 Ctrl+C。\nagent 接入配置：agent-mcp-config.json\n');
if(!process.argv.includes('--no-open')){
  for(let attempt=0;attempt<30;attempt++){try{if((await fetch(url+'/api/cases')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  const command=process.platform==='darwin'?'open':process.platform==='win32'?'rundll32':'xdg-open';
  const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
  const child=spawn(command,args,{stdio:'ignore',detached:true});child.on('error',()=>console.log('请手动打开上面的本地网址。'));child.unref();
}
