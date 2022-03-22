import { fromUtf8 } from "../cosmwasm-encoding";
import { allocate, deallocate, readRegion, Region, wrapOk } from "./cosmwasm";

describe("cosmwasm", () => {
  describe("allocate", () => {
    it("can allocate memory", () => {
      const region = changetype<Region>(allocate(33));

      const data = changetype<ArrayBuffer>(region.offset);
      expect(data.byteLength).toStrictEqual(33);

      deallocate(changetype<usize>(region));
    });

    it("can read header", () => {
      const region = changetype<Region>(allocate(33));

      const dummyArrayBuffer = new ArrayBuffer(33);
      const expectedMmInfo = load<usize>(changetype<usize>(dummyArrayBuffer) - 20);

      // See https://docs.assemblyscript.org/details/memory#internals
      const dataPtr = region.offset;
      const mmInfo = load<usize>(dataPtr - 20);
      const gcInfo = load<usize>(dataPtr - 16);
      const rtId = load<u32>(dataPtr - 8);
      const rtSize = load<u32>(dataPtr - 4);
      expect(mmInfo).toStrictEqual(expectedMmInfo);
      expect(gcInfo).toStrictEqual(0);
      expect(rtId).toStrictEqual(idof<ArrayBuffer>());
      expect(rtSize).toStrictEqual(33);

      deallocate(changetype<usize>(region));
    });
  });

  describe("readRegion", () => {
    it("reads the correct bytes", () => {
      const regionPtr = allocate(33);
      const region = changetype<Region>(regionPtr);

      // write some data
      store<u8>(region.offset + 0, 0xaa);
      store<u8>(region.offset + 1, 0xbb);
      store<u8>(region.offset + 2, 0xcc);
      region.len = 3;

      const data = readRegion(regionPtr);
      expect(data.length).toStrictEqual(3);
      expect(data[0]).toStrictEqual(0xaa);
      expect(data[1]).toStrictEqual(0xbb);
      expect(data[2]).toStrictEqual(0xcc);

      deallocate(regionPtr);
    });
  });

  describe("wrapOk", () => {
    it("works", () => {
      const data = new Uint8Array(3);
      data[0] = 0x61;
      data[1] = 0x62;
      data[2] = 0x63;
      const wrapped = wrapOk(data);
      expect(fromUtf8(wrapped)).toStrictEqual('{"ok":"YWJj"}');
    });
  });
});
