import { JSONEncoder } from "assemblyscript-json";

import { Base64, toUtf8 } from "../cosmwasm-encoding";
import * as env from "./env";

/**
 * Refers to some heap allocated data in wasm.
 * A pointer to this can be returned over ffi boundaries.
 */
@unmanaged
export class Region {
  offset: u32;
  len: u32;
}

/**
 * Reserves the given number of bytes in wasm memory. Creates a Region and returns a pointer
 * to that Region.
 * This space is managed by the calling process and should be accompanied by a corresponding deallocate.
 */
export function allocate(size: usize): usize {
  // Like `new ArrayBuffer(size);` but without zeroing memory
  // See https://github.com/AssemblyScript/assemblyscript/blob/v0.9.0/std/assembly/arraybuffer.ts#L53-L58
  const data = changetype<ArrayBuffer>(__new(size, idof<ArrayBuffer>()));
  const dataPtr = changetype<u32>(data);
  __pin(dataPtr);
  const region: Region = {
    offset: dataPtr,
    len: changetype<u32>(size),
  };
  const regionPtr = changetype<usize>(region);
  __pin(regionPtr);
  return regionPtr;
}

/**
 * Expects a pointer to a Region created with allocate.
 * It will free both the Region and the memory referenced by the Region.
 */
export function deallocate(regionPtr: usize): void {
  const dataPtr = changetype<Region>(regionPtr).offset;
  __unpin(regionPtr); // release Region
  __unpin(dataPtr); // release ArrayBuffer
}

export function readRegion(regionPtr: usize): Uint8Array {
  const region = changetype<Region>(regionPtr);
  // The ArrayBuffer here was created using the `allocate` function. Thus we
  // know the 16 byte common header is prepended to `region.offset`.
  // Note: the ArrayBuffer might be longer than the length stored in the region.
  const data = changetype<ArrayBuffer>(region.offset);
  return Uint8Array.wrap(data, 0, region.len);
}

function getDataPtr(arr: Uint8Array): usize {
  return changetype<usize>(arr.buffer) + arr.byteOffset;
}

/**
 * Releases ownership of the data without destroying it.
 */
export function releaseOwnership(data: Uint8Array): usize {
  const dataPtr = getDataPtr(data);

  const region: Region = {
    offset: dataPtr,
    len: data.byteLength,
  };
  const regionPtr = changetype<usize>(region);

  // Retain both raw data as well as the Region object referring to it
  __pin(dataPtr);
  __pin(regionPtr);

  return regionPtr;
}

/**
 * Creates a Region linking to the given data.
 * Keeps ownership of the data and the Region and returns a pointer to the Region.
 */
export function keepOwnership(data: Uint8Array): usize {
  const dataPtr = getDataPtr(data);

  const region: Region = {
    offset: dataPtr,
    len: data.byteLength,
  };
  return changetype<usize>(region);
}

/**
 * Takes ownership of the data at the given pointer
 */
export function takeOwnership(regionPtr: usize): Uint8Array {
  const out = readRegion(regionPtr);
  deallocate(regionPtr);
  return out;
}

export function log(text: string): void {
  const data = toUtf8(text);
  env.log(keepOwnership(data));
}

export function logAndCrash(
  message: string | null,
  fileName: string | null,
  lineNumber: u32,
  columnNumber: u32,
): void {
  const msg =
    "Aborted with message '" +
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (message || "unset")! +
    " (in '" +
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (fileName || "unset")! +
    "', line " +
    lineNumber.toString() +
    ", column " +
    columnNumber.toString() +
    ")";
  log(msg);
  unreachable(); // crash hard
}

export function wrapOk(data: Uint8Array): Uint8Array {
  const encoder = new JSONEncoder();
  encoder.pushObject(null);
  encoder.setString("ok", Base64.encode(data));
  encoder.popObject();
  return encoder.serialize();
}
