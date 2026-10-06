case "sortDoubleSplats": {
          const { numSplats, readback, ordering } = args;
          {
            const benchmarkSortStarted = performance.now();
      const benchmarkActiveSplats = sort_splats(numSplats, readback, ordering);
      const benchmarkSortMs = performance.now() - benchmarkSortStarted;
      result = {
              id,
              readback,
              ordering,
              activeSplats: benchmarkActiveSplats,
        benchmarkSortMs
            };
          }
          break;
        }
        case "sort32Splats": {
          const { numSplats, readback, ordering } = args;
          {
            const benchmarkSortStarted = performance.now();
      const benchmarkActiveSplats = sort32_splats(numSplats, readback, ordering);
      const benchmarkSortMs = performance.now() - benchmarkSortStarted;
      result = {
              id,
              readback,
              ordering,
              activeSplats: benchmarkActiveSplats,
        benchmarkSortMs
            };
          }
          break;
        }
        