  async sortUpdate({
    accumulator,
    viewToWorld,
    displayed = false
  }) {
    if (this.sortingCheck) {
      throw new Error("Only one sort at a time");
    }
    this.sortingCheck = true;
    const benchmarkStarted = performance.now();
    let benchmarkTiming = null;
    accumulator = accumulator ?? this.spark.active;
    const { numSplats, maxSplats } = accumulator.splats;
    let activeSplats = 0;
    let ordering = this.orderingFreelist.alloc(maxSplats);
    if (this.stochastic) {
      activeSplats = numSplats;
      for (let i = 0; i < numSplats; ++i) {
        ordering[i] = i;
      }
    } else if (numSplats > 0) {
      const {
        reader,
        doubleSortReader,
        sort32Reader,
        dynoSortRadial,
        dynoOrigin,
        dynoDirection,
        dynoDepthBias,
        dynoSort360,
        dynoSplats
      } = _SparkViewpoint.makeSorter();
      const sort32 = this.sort32 ?? false;
      let readback;
      if (sort32) {
        this.readback32 = reader.ensureBuffer(maxSplats, this.readback32);
        readback = this.readback32;
      } else {
        const halfMaxSplats = Math.ceil(maxSplats / 2);
        this.readback16 = reader.ensureBuffer(halfMaxSplats, this.readback16);
        readback = this.readback16;
      }
      const worldToOrigin = accumulator.toWorld.clone().invert();
      const viewToOrigin = viewToWorld.clone().premultiply(worldToOrigin);
      dynoSortRadial.value = this.sort360 ? true : this.sortRadial;
      dynoOrigin.value.set(0, 0, 0).applyMatrix4(viewToOrigin);
      dynoDirection.value.set(0, 0, -1).applyMatrix4(viewToOrigin).sub(dynoOrigin.value).normalize();
      dynoDepthBias.value = this.depthBias ?? 1;
      dynoSort360.value = this.sort360 ?? false;
      dynoSplats.packedSplats = accumulator.splats;
      const sortReader = sort32 ? sort32Reader : doubleSortReader;
      const count = sort32 ? numSplats : Math.ceil(numSplats / 2);
      const benchmarkReadbackStarted = performance.now();
      await reader.renderReadback({
        renderer: this.spark.renderer,
        reader: sortReader,
        count,
        readback
      });
      const benchmarkReadbackMs = performance.now() - benchmarkReadbackStarted;
      const benchmarkRpcStarted = performance.now();
      const result = await withWorker(async (worker) => {
        const rpcName = sort32 ? "sort32Splats" : "sortDoubleSplats";
        return worker.call(rpcName, {
          maxSplats,
          numSplats,
          readback,
          ordering
        });
      });
      const benchmarkRpcMs = performance.now() - benchmarkRpcStarted;
      benchmarkTiming = {cpuSortMs: result.benchmarkSortMs, metricReadbackWallMs: benchmarkReadbackMs, workerRoundtripMs: benchmarkRpcMs, sortBits: sort32 ? 32 : 16};
      if (sort32) {
        this.readback32 = result.readback;
      } else {
        this.readback16 = result.readback;
      }
      ordering = result.ordering;
      activeSplats = result.activeSplats;
    }
    const benchmarkUploadStarted = performance.now();
    this.updateDisplay({
      accumulator,
      viewToWorld,
      ordering,
      activeSplats,
      displayed
    });
    this.benchmarkLastSort = {
      ...benchmarkTiming,
      orderingUploadWallMs: performance.now() - benchmarkUploadStarted,
      sortUpdateWallMs: performance.now() - benchmarkStarted,
      numSplats, sortedSplats: activeSplats,
      sequence: (this.benchmarkLastSort?.sequence ?? 0) + 1,
      completedAt: performance.now(),
      sortedViewOrigin: new THREE.Vector3().setFromMatrixPosition(viewToWorld).toArray(),
      sortedViewDirection: new THREE.Vector3(0, 0, -1).transformDirection(viewToWorld).toArray(),
      mappingVersion: accumulator.mappingVersion,
    };
    this.sortingCheck = false;
  }
