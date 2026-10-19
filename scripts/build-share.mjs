import { build } from 'esbuild';
import { cp, mkdir, mkdtemp, readFile, writeFile, readdir, rm, rename, chmod, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const pkg=JSON.parse(await readFile('package.json','utf8'));
const name=`LabFlow-${pkg.version}-team`;
const staging=await mkdtemp(join(tmpdir(),'labflow-share-'));
const target=join(staging,name), output=resolve('releases');
try {
  await mkdir(join(target,'server'),{recursive:true});await mkdir(output,{recursive:true});
  const options={bundle:true,platform:'node',target:'node22',format:'esm',external:['vite'],metafile:true,banner:{js:'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'}};
  const application=await build({...options,entryPoints:['server/index.ts'],outfile:join(target,'server/app.mjs')});
  const mcp=await build({...options,entryPoints:['server/mcp.ts'],outfile:join(target,'server/mcp.mjs')});
  await cp('dist',join(target,'dist'),{recursive:true});
  for(const file of ['.codex-plugin/plugin.json','.mcp.json','skills/labflow-tutor/SKILL.md']) {
    await mkdir(dirname(join(target,'plugin',file)),{recursive:true});await cp(join('plugin',file),join(target,'plugin',file));
  }
  await writeFile(join(target,'plugin/server.mjs'),"await import('../server/mcp.mjs');\n");
  const manifest=JSON.parse(await readFile(join(target,'plugin/.mcp.json'),'utf8'));
  manifest.mcpServers.labflow.command='node';manifest.mcpServers.labflow.args=['./server.mjs'];
  await writeFile(join(target,'plugin/.mcp.json'),JSON.stringify(manifest,null,2)+'\n');
  await cp('scripts/share',target,{recursive:true});
  await mkdir(join(target,'docs'),{recursive:true});
  for(const file of ['ai-backends.md','wb-sources.md','release-0.2.0.md','release-0.2.1.md','manual-testing-0.2.1.md','release-0.3.0.md','manual-testing-0.3.0.md','interactive-lab-scenes.md','qa-0.3.0.md'])await cp(join('docs',file),join(target,'docs',file));
  await cp('docs/scene-preview',join(target,'docs/scene-preview'),{recursive:true});
  const windows=join(target,'Start-LabFlow.cmd');
  await writeFile(windows,(await readFile(windows,'utf8')).replace(/\r?\n/g,'\r\n'));
  await chmod(join(target,'Start-LabFlow.command'),0o755);
  // Keep notices for bundled dependencies; never copy runtime/auth data.
  const packages=new Set();
  for(const input of [...Object.keys(application.metafile.inputs),...Object.keys(mcp.metafile.inputs)]) {
    if(!input.includes('node_modules'))continue;
    let directory=dirname(resolve(input));
    while(directory!==root&&dirname(directory)!==directory){if(existsSync(join(directory,'package.json'))){packages.add(directory);break;}directory=dirname(directory);}
  }
  // Include frontend transitive dependencies too (the Vite bundle is separate).
  for(const entry of await readdir('node_modules/.pnpm')) {
    const modules=resolve('node_modules/.pnpm',entry,'node_modules');if(!existsSync(modules))continue;
    for(const name of await readdir(modules)){
      const paths=name.startsWith('@')?(await readdir(join(modules,name))).map(child=>join(modules,name,child)):[join(modules,name)];
      for(const path of paths)if(existsSync(join(path,'package.json')))packages.add(await realpath(path));
    }
  }
  let notices='Bundled open-source dependency notices\n';
  for(const directory of [...packages].sort()){
    const metadata=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
    notices+=`\n===== ${metadata.name} ${metadata.version} (${metadata.license||'see license'}) =====\n`;
    for(const file of await readdir(directory))if(/^(license|licence|copying|notice)(\.|$)/i.test(file))notices+=await readFile(join(directory,file),'utf8')+'\n';
  }
  await writeFile(join(target,'THIRD-PARTY-NOTICES.txt'),notices);
  await writeFile(join(target,'VERSION.txt'),`${pkg.version}\nsource: ${execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}\nbuilt: ${new Date().toISOString()}\n`);
  const temporary=join(staging,name+'.zip');
  execFileSync('zip',['-q','-r',temporary,name],{cwd:staging});
  const file=join(output,name+'.zip');await rename(temporary,file);
  const bytes=await readFile(file);const hash=createHash('sha256').update(bytes).digest('hex');
  await writeFile(file+'.sha256',hash+'  '+name+'.zip\n');
  console.log(`${file}\n${(bytes.length/1024/1024).toFixed(2)} MB\nSHA-256 ${hash}`);
}finally{await rm(staging,{recursive:true,force:true});}
