/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

import {
  ERR_DOC_NOT_FOUND,
  ERR_DOC_NOT_PUBLISHED,
  ERR_SYNC_NO_CHANGES,
  ERR_SYNC_SUCCESS,
  ERR_SYNC_STARTED,
  ERR_API_FAILED,
  ERR_UPLOAD_MEDIA,
  ERR_FETCH_CONTENT,
} from "../index";

import { sanitizeErrorForLogging } from "../sanitize";

describe("Error constants", () => {
  it("defines all expected error codes", () => {
    expect(ERR_DOC_NOT_FOUND).toBe("ERR_DOC_NOT_FOUND");
    expect(ERR_DOC_NOT_PUBLISHED).toBe("ERR_DOC_NOT_PUBLISHED");
    expect(ERR_SYNC_NO_CHANGES).toBe("ERR_SYNC_NO_CHANGES");
    expect(ERR_SYNC_SUCCESS).toBe("ERR_SYNC_SUCCESS");
    expect(ERR_SYNC_STARTED).toBe("ERR_SYNC_STARTED");
    expect(ERR_API_FAILED).toBe("ERR_API_FAILED");
    expect(ERR_UPLOAD_MEDIA).toBe("ERR_UPLOAD_MEDIA");
    expect(ERR_FETCH_CONTENT).toBe("ERR_FETCH_CONTENT");
  });

  it("all constants are unique", () => {
    const codes = [
      ERR_DOC_NOT_FOUND,
      ERR_DOC_NOT_PUBLISHED,
      ERR_SYNC_NO_CHANGES,
      ERR_SYNC_SUCCESS,
      ERR_SYNC_STARTED,
      ERR_API_FAILED,
      ERR_UPLOAD_MEDIA,
      ERR_FETCH_CONTENT,
    ];
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("sanitizeErrorForLogging", () => {
  it("returns message and name from Error instance", () => {
    const error = new Error("Something went wrong");
    const result = sanitizeErrorForLogging(error);
    expect(result).toEqual({
      message: "Something went wrong",
      name: "Error",
    });
  });

  it("does NOT include stack trace", () => {
    const error = new Error("Secret info");
    const result = sanitizeErrorForLogging(error);
    expect(result).not.toHaveProperty("stack");
  });

  it("does NOT include cause", () => {
    const error = new Error("With cause", { cause: "internal detail" });
    const result = sanitizeErrorForLogging(error);
    expect(result).not.toHaveProperty("cause");
  });

  it("handles non-Error values (strings)", () => {
    const result = sanitizeErrorForLogging("just a string");
    expect(result).toEqual({
      message: "just a string",
      name: "UnknownError",
    });
  });

  it("handles null", () => {
    const result = sanitizeErrorForLogging(null);
    expect(result).toEqual({
      message: "null",
      name: "UnknownError",
    });
  });

  it("handles undefined", () => {
    const result = sanitizeErrorForLogging(undefined);
    expect(result).toEqual({
      message: "undefined",
      name: "UnknownError",
    });
  });

  it("handles objects", () => {
    const result = sanitizeErrorForLogging({ custom: "error" });
    expect(result).toEqual({
      message: "[object Object]",
      name: "UnknownError",
    });
  });

  it("handles Error subclasses (custom errors)", () => {
    class CustomError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "CustomError";
      }
    }
    const error = new CustomError("Custom problem");
    const result = sanitizeErrorForLogging(error);
    expect(result).toEqual({
      message: "Custom problem",
      name: "CustomError",
    });
  });

  it("handles TypeError with message", () => {
    const error = new TypeError("Invalid type");
    const result = sanitizeErrorForLogging(error);
    expect(result.name).toBe("TypeError");
    expect(result.message).toBe("Invalid type");
  });

  it("handles Error with empty message", () => {
    const error = new Error("");
    const result = sanitizeErrorForLogging(error);
    expect(result.message).toBe("");
    expect(result.name).toBe("Error");
  });
});
