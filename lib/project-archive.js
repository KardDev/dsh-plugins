import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {crc32} from 'node:zlib';
// Small, standard ZIP (stored entries). Only this job's generated filenames
// enter the archive. No shell/archiver dependency or user-directory traversal.
export async function archiveProject(directory,files){
 const locals=[],central=[];let offset=0;
 for(const name of [...new Set(files)]){
  if(!/^[\w-]+\.[\w]+$/.test(name))throw Error('Motion video: invalid project filename');
  const body=await readFile(join(directory,name)),n=Buffer.from(name),crc=crc32(body),h=Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(body.length,22);h.writeUInt16LE(n.length,26);
  locals.push(h,n,body);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(body.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+body.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 await writeFile(join(directory,'project.zip'),Buffer.concat([...locals,...central,end]));
}
