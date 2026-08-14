import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePagedList } from "./library-browser";
import type { Page } from "@/lib/spotify-client";

const PAGE = 50;
const TOTAL = 200;

const pageAt = (offset: number): Page<{ uri: string }> => ({
  items: Array.from({ length: PAGE }, (_, i) => ({ uri: `t${offset + i}` })),
  total: TOTAL,
});

const offsetsOf = (fetchPage: { mock: { calls: [number, string][] } }) =>
  fetchPage.mock.calls.map(([offset]) => offset);

describe("usePagedList", () => {
  beforeEach(() => {
    // getToken() is a bare fetch of the session route
    vi.stubGlobal("fetch", async () => ({
      json: async () => ({ accessToken: "token" }),
    }));
  });

  it("does not refetch an offset for a scroll handler that is a render behind", async () => {
    const fetchPage = vi.fn(async (offset: number) => pageAt(offset));
    const { result } = renderHook(() => usePagedList("liked", fetchPage));
    await waitFor(() => expect(result.current.items).toHaveLength(PAGE));

    // the handler React installed for the 50-item render — a scroll firing
    // between the second page arriving and its commit still calls this one
    const staleLoadMore = result.current.loadMore;
    act(() => staleLoadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2 * PAGE));
    act(() => staleLoadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(3 * PAGE));

    expect(offsetsOf(fetchPage)).toEqual([0, PAGE, 2 * PAGE]);
    const uris = result.current.items.map((t) => t.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it("keeps paging after a rejected page instead of wedging", async () => {
    const fetchPage = vi.fn(async (offset: number) => {
      if (offset === PAGE) throw new Error("offline");
      return pageAt(offset);
    });
    const { result } = renderHook(() => usePagedList("liked", fetchPage));
    await waitFor(() => expect(result.current.items).toHaveLength(PAGE));

    // await the async act so the rejection is fully settled — the mock records
    // its call synchronously, so asserting on offsets alone would race it
    await act(async () => {
      result.current.loadMore();
    });
    expect(offsetsOf(fetchPage)).toEqual([0, PAGE]);

    // the rejection must release the offset, or loadMore treats that page as
    // forever in flight and the list silently stops growing
    await act(async () => {
      result.current.loadMore();
    });
    expect(offsetsOf(fetchPage)).toEqual([0, PAGE, PAGE]);
  });

  it("resets and pages again from zero when the key changes", async () => {
    const fetchPage = vi.fn(async (offset: number) => pageAt(offset));
    const { result, rerender } = renderHook(
      ({ k }) => usePagedList(k, fetchPage),
      { initialProps: { k: "spotify:playlist:a" } }
    );
    await waitFor(() => expect(result.current.items).toHaveLength(PAGE));

    rerender({ k: "spotify:playlist:b" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2 * PAGE));

    expect(offsetsOf(fetchPage)).toEqual([0, 0, PAGE]);
    expect(result.current.total).toBe(TOTAL);
  });
});
