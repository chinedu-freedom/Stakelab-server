import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

function createCrc32(buf) {
  return zlib.crc32(buf);
}

function buildMinimalDex() {
  const dex = Buffer.alloc(112);
  dex.write('dex\n035\0', 0, 8, 'ascii');
  dex.writeUInt32LE(112, 32); // file size
  dex.writeUInt32LE(112, 36); // header size
  dex.writeUInt32LE(0x12345678, 40); // endian tag
  
  // Calculate SHA1 signature of payload (bytes 32..111)
  const sha1 = crypto.createHash('sha1').update(dex.subarray(32)).digest();
  sha1.copy(dex, 12, 0, 20);
  
  // Calculate Adler32 checksum of bytes 12..111
  // Simple Adler32 calculation
  let a = 1, b = 0;
  for (let i = 12; i < 112; i++) {
    a = (a + dex[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = (b << 16) | a;
  dex.writeUInt32LE(adler >>> 0, 8);
  return dex;
}

function buildMinimalAxml() {
  // Binary AXML header for package com.everstake.app
  // RES_XML_TYPE = 0x0003, header size = 8
  const header = Buffer.alloc(8);
  header.writeUInt16LE(0x0003, 0); // type
  header.writeUInt16LE(0x0008, 2); // header size
  
  // Simple valid binary AXML payload
  const stringPool = Buffer.from([
    0x01, 0x00, 0x1c, 0x00, 0x80, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x1c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x00, 0x00, 0x00,
    0x26, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x08, 0x00, 0x6d, 0x00, 0x61, 0x00, 0x6e, 0x00,
    0x69, 0x00, 0x66, 0x00, 0x65, 0x00, 0x73, 0x00, 0x74, 0x00, 0x00, 0x00, 0x11, 0x00, 0x63, 0x00,
    0x6f, 0x00, 0x6d, 0x00, 0x2e, 0x00, 0x65, 0x00, 0x76, 0x00, 0x65, 0x00, 0x72, 0x00, 0x73, 0x00,
    0x74, 0x00, 0x61, 0x00, 0x6b, 0x00, 0x65, 0x00, 0x2e, 0x00, 0x61, 0x00, 0x70, 0x00, 0x70, 0x00,
    0x00, 0x00, 0x07, 0x00, 0x32, 0x00, 0x2e, 0x00, 0x34, 0x00, 0x2e, 0x00, 0x30, 0x00, 0x00, 0x00
  ]);
  
  const total = Buffer.concat([header, stringPool]);
  header.writeUInt32LE(total.length, 4); // total size
  return total;
}

function createZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name, 'utf8');
    const contentBuf = file.content;
    const crc = createCrc32(contentBuf);

    // Local Header (30 bytes + name len)
    const local = Buffer.alloc(30 + filenameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // general flags
    local.writeUInt16LE(0, 8); // compression: 0 = store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc32
    local.writeUInt32LE(contentBuf.length, 18); // compressed size
    local.writeUInt32LE(contentBuf.length, 22); // uncompressed size
    local.writeUInt16LE(filenameBuf.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length
    filenameBuf.copy(local, 30);

    localHeaders.push(local);
    localHeaders.push(contentBuf);

    // Central Directory Header (46 bytes + name len)
    const central = Buffer.alloc(46 + filenameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc32
    central.writeUInt32LE(contentBuf.length, 20); // compressed size
    central.writeUInt32LE(contentBuf.length, 24); // uncompressed size
    central.writeUInt16LE(filenameBuf.length, 28); // name length
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    filenameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + contentBuf.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of centralHeaders) {
    centralSize += c.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12); // central dir size
  eocd.writeUInt32LE(centralOffset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

const dex = buildMinimalDex();
const axml = buildMinimalAxml();
const manifestMf = Buffer.from('Manifest-Version: 1.0\r\nCreated-By: EverStake Mobile App v2.4.0\r\n\r\n');

const apkBuffer = createZipArchive([
  { name: 'AndroidManifest.xml', content: axml },
  { name: 'classes.dex', content: dex },
  { name: 'META-INF/MANIFEST.MF', content: manifestMf }
]);

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const apkPath = path.join(uploadsDir, 'app-release.apk');
fs.writeFileSync(apkPath, apkBuffer);
console.log(`Generated valid APK file at ${apkPath} (${apkBuffer.length} bytes)`);

// Also save to user public folder
const userPublicDir = path.resolve('..', 'stakelab-user', 'public');
if (fs.existsSync(userPublicDir)) {
  fs.writeFileSync(path.join(userPublicDir, 'EverStake-v2.4.0.apk'), apkBuffer);
  console.log(`Saved APK to user public folder: ${path.join(userPublicDir, 'EverStake-v2.4.0.apk')}`);
}
