// 시험 보조 파일: Next.js 가 서버 액션 요청을 읽을 때 쓰는 것과 같은 부품(busboy + React 의 decodeReplyFromBusboy)으로
// 「파일을 고르지 않은 폼」과 「실제 빈 파일을 고른 폼」이 서버에서 어떤 모양(name/size/type)이 되는지 JSON 으로 출력합니다.
// 네트워크·DB 를 쓰지 않으며, 실행: node --conditions=react-server tests/fixtures/decode-empty-file.mjs
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const require = createRequire(pathToFileURL(path.join(root, "package.json")));
const busboy = require("next/dist/compiled/busboy");
const serverModule = require.resolve("next/dist/compiled/react-server-dom-webpack/server.node.js");
const { decodeReplyFromBusboy } = await import(pathToFileURL(serverModule).href);

const B = "----WebKitFormBoundaryTest";
const part = (headers, value) => `--${B}\r\n${headers}\r\n\r\n${value}\r\n`;

async function decode(fileHeaders, fileValue) {
  const body =
    part('Content-Disposition: form-data; name="_1_title"', "hello") +
    part(fileHeaders, fileValue) +
    part('Content-Disposition: form-data; name="0"', '[null,"$K1"]') +
    `--${B}--\r\n`;
  const bb = busboy({ headers: { "content-type": `multipart/form-data; boundary=${B}` } });
  const result = decodeReplyFromBusboy(bb, {});
  Readable.from([Buffer.from(body)]).pipe(bb);
  const form = (await result)[1];
  const f = form.get("image");
  return typeof f === "object" && f !== null
    ? { kind: "file", name: f.name, size: f.size, type: f.type }
    : { kind: typeof f, value: f };
}

const out = {
  // 브라우저에서 파일을 고르지 않은 경우: filename="" 이고 형식은 application/octet-stream
  unselected: await decode('Content-Disposition: form-data; name="_1_image"; filename=""\r\nContent-Type: application/octet-stream', ""),
  // 크기 0 의 실제 파일(photo.png)을 고른 경우
  emptyPng: await decode('Content-Disposition: form-data; name="_1_image"; filename="photo.png"\r\nContent-Type: image/png', ""),
  // 형식을 알 수 없는 이름의 실제 빈 파일(예: data.dat)
  emptyUnknown: await decode('Content-Disposition: form-data; name="_1_image"; filename="data.dat"\r\nContent-Type: application/octet-stream', ""),
  // 내용이 있는 파일
  withContent: await decode('Content-Disposition: form-data; name="_1_image"; filename="a.png"\r\nContent-Type: image/png', "abc"),
};
console.log(JSON.stringify(out));
