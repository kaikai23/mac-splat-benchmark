#!/usr/bin/env python3
"""Independent CPU-only audit of complete Visionary native ONNX dynamic runs.

This audits normalized time-conditioned inference, never PLY frame replacement.
Probe output is not a benchmark. Complete FPS uses measured round windows;
renderCompletionMs alone excludes inference and is not native dynamic FPS.
"""
from __future__ import annotations

import argparse
import base64
from collections import Counter
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
HASH = re.compile(r"^[0-9a-f]{64}$")
CAPTURE_INDICES = [0, 50, 100, 149]
GAUSSIAN_FIELDS = ['x','y','z','alpha','cov00','cov01','cov02','cov11','cov12','cov22']


class Invalid(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise Invalid(message)


def finite(value, name, minimum=0, positive=False):
    require(type(value) in (int, float) and math.isfinite(value), f"{name}: non-finite/non-numeric")
    require(value > minimum if positive else value >= minimum, f"{name}: out of range")
    return value


def integer(value, name, minimum=0):
    require(type(value) is int and value >= minimum, f"{name}: invalid integer")
    return value


def close(actual, expected, name):
    finite(actual, name)
    require(math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-6), f"{name}: {actual!r} differs from {expected!r}")


def f32(value):
    return struct.unpack("<f", struct.pack("<f", value))[0]


def quantile(values, probability):
    require(values, "Empty quantile input")
    ordered = sorted(finite(v, "quantile value") for v in values)
    position = probability * (len(ordered)-1)
    lo, hi = math.floor(position), math.ceil(position)
    return ordered[lo] + (ordered[hi]-ordered[lo]) * (position-lo)


def summary(values):
    require(values, "Empty metric input")
    return {"meanMs": sum(values)/len(values), "p50Ms": quantile(values, .5), "p95Ms": quantile(values, .95)}


def stamp(value):
    require(isinstance(value, str), "Missing UTC timestamp")
    result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None and result.utcoffset() == dt.timedelta(0), "Timestamp is not UTC")
    return result


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(8*1024*1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    with Path(path).open(encoding="utf-8") as stream:
        return json.load(stream, parse_constant=lambda value: (_ for _ in ()).throw(Invalid(f"Non-JSON number: {value}")))


def child(root, name):
    require(isinstance(name, str) and name and not Path(name).is_absolute() and ".." not in Path(name).parts, "Unsafe relative file path")
    result = (root/name).resolve()
    require(result.is_relative_to(root.resolve()), "File path escapes its root")
    return result


def power(value):
    require(isinstance(value, dict) and "'AC Power'" in value.get("power", ""), "Missing or non-AC power observation")
    return stamp(value["at"])


def native_culled_nonfinite(values):
    """Only covariance values unread after the upstream strict-alpha return may be nonfinite."""
    require(len(values) == 10 and all(math.isfinite(v) for v in values[:4]), "Nonfinite position/opacity cannot be safely opacity-culled")
    bad = [i for i, value in enumerate(values) if not math.isfinite(value)]
    require(not bad or (all(i >= 4 for i in bad) and values[3] < .02), "Nonfinite covariance reaches native alpha>=0.02 render path")
    return bad


def nonfinite_evidence(bounds, capacity, time):
    n = integer(bounds["inspectedCount"], "full-scan active count", 1)
    require(bounds["opacityThreshold"] == .02 and bounds["diagnosticNonfiniteEnabled"] is False, "Relaxed diagnostic mode cannot pass pilot/formal")
    total = integer(bounds["nonfiniteGaussianCount"], "nonfinite row count")
    require(integer(bounds["nonfiniteCulledGaussianCount"], "culled nonfinite row count") == total and bounds["nonfiniteRenderableGaussianCount"] == 0, "Nonfinite renderable Gaussian remains")
    require(bounds["allGaussianFieldsFinite"] is (total == 0) and bounds["allRenderableGaussianFieldsFinite"] is True, "Finite-content flags disagree with observed counts")
    examples = bounds["nonfiniteExamples"]
    require(len(examples) == total, "Missing raw evidence for one or more nonfinite rows")
    seen, fields = set(), Counter({name:0 for name in GAUSSIAN_FIELDS})
    for example in examples:
        row = integer(example["row"], "nonfinite row index")
        require(row < n and row not in seen, "Duplicate/out-of-range nonfinite row")
        seen.add(row)
        require(example["actualCount"] == n and example["capacity"] == capacity and example["onnxInputTime"] == f32(time), "Nonfinite evidence identity mismatch")
        require(example["fields"] == GAUSSIAN_FIELDS and example["precision"]["dataType"] == "float16" and example["precision"]["bytesPerElement"] == 2, "Nonfinite row layout mismatch")
        require(isinstance(example["rawHex"], str) and re.fullmatch(r"[0-9a-f]{40}", example["rawHex"]), "Nonfinite row raw bytes missing")
        values = list(struct.unpack("<10e", bytes.fromhex(example["rawHex"])))
        bad = native_culled_nonfinite(values)
        require(bad and example["nonfiniteFields"] == [GAUSSIAN_FIELDS[i] for i in bad], "Nonfinite scalar inventory differs from raw bytes")
        require(example["safelyOpacityCulled"] is True and example["positionOpacityFinite"] is True and example["opacityPassesNativeCull"] is False, "Nonfinite opacity-cull flags differ")
        require(len(example["values"]) == 10, "Missing decoded nonfinite row values")
        for reported, actual in zip(example["values"], values):
            parsed = float(reported)
            require(parsed == actual or (math.isnan(parsed) and math.isnan(actual)), "Independent raw nonfinite-row decode differs")
        fields.update(GAUSSIAN_FIELDS[i] for i in bad)
    require(bounds["nonfiniteByField"] == dict(fields) and bounds["nonfiniteValueCount"] == sum(fields.values()), "Nonfinite scalar counts differ from complete raw-row evidence")
    return {"nonfiniteGaussianCount":total, "nonfiniteCulledGaussianCount":total, "nonfiniteRenderableGaussianCount":0, "nonfiniteValueCount":sum(fields.values())}


def proto_fields(data):
    """Minimal independent protobuf wire reader; skips weight payloads by view."""
    data = memoryview(data)
    at = 0
    def varint():
        nonlocal at
        value, shift = 0, 0
        while at < len(data) and shift < 70:
            byte = data[at]; at += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
            shift += 7
        raise Invalid("Truncated/oversized protobuf varint")
    while at < len(data):
        key = varint(); number, wire = key >> 3, key & 7
        require(number > 0, "Invalid protobuf field number")
        if wire == 0:
            value = varint()
        elif wire in (1, 2, 5):
            size = varint() if wire == 2 else 8 if wire == 1 else 4
            require(at + size <= len(data), "Truncated protobuf field")
            value = data[at:at+size]; at += size
        else:
            raise Invalid(f"Unsupported protobuf wire type {wire}")
        yield number, wire, value


def proto_map(data):
    result = {}
    for number, wire, value in proto_fields(data):
        result.setdefault(number, []).append(value)
    return result


def text_field(mapping, key, default=""):
    return bytes(mapping[key][0]).decode("utf-8") if key in mapping else default


def value_info(data):
    value = proto_map(data)
    tensor = proto_map(proto_map(value[2][0])[1][0])
    shape = []
    for dim in proto_map(tensor[2][0]).get(1, []):
        item = proto_map(dim)
        shape.append(text_field(item, 2) if 2 in item else item[1][0])
    return {"name": text_field(value, 1), "dataType": tensor[1][0], "shape": shape}


def model_info(path):
    blob = path.read_bytes()
    model = proto_map(blob)
    graph = proto_map(model[7][0])
    operators = Counter(text_field(proto_map(node), 4) for node in graph.get(1, []))
    for initializer in graph.get(5, []):
        tensor = proto_map(initializer)
        require(not tensor.get(13) and tensor.get(14, [0])[0] != 1, "External ONNX tensor data is unsupported")
    opsets = []
    for value in model.get(8, []):
        op = proto_map(value)
        opsets.append({"domain": text_field(op, 1), "version": op[2][0]})
    metadata = []
    for value in model.get(14, []):
        item = proto_map(value)
        metadata.append({"key": text_field(item, 1), "value": text_field(item, 2)})
    require(operators and "GridSample" in operators, "No expected time-deformation graph")
    return {"schema": "visionary-native-model-v1", "filename": path.name, "bytes": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest(), "producer": text_field(model, 2),
            "producerVersion": text_field(model, 3), "irVersion": model[1][0],
            "graphName": text_field(graph, 2), "docString": text_field(model, 6) or text_field(graph, 10),
            "opsets": opsets, "inputs": [value_info(v) for v in graph.get(11, [])],
            "outputs": [value_info(v) for v in graph.get(12, [])], "nodeCount": len(graph.get(1, [])),
            "initializerCount": len(graph.get(5, [])), "operators": dict(operators), "metadata": metadata, "externalData": False}


class Audit:
    def __init__(self, run):
        self.run = Path(run).resolve()
        self.sources = {}
        self.errors = []
        self.records = []
        self.protocol = {}
        self.protocol_sha = None

    def bind(self, path, expected=None, size=None):
        path = Path(path).resolve()
        require(path.is_file(), f"Missing file: {path}")
        digest = sha(path)
        if expected is not None:
            require(isinstance(expected, str) and HASH.fullmatch(expected) and digest == expected, f"SHA256 mismatch: {path}")
        if size is not None:
            require(path.stat().st_size == size, f"Byte count differs: {path}")
        self.sources[str(path)] = {"path": os.path.relpath(path, ROOT), "sha256": digest, "bytes": path.stat().st_size}
        return digest

    def load(self, filename):
        path = child(self.run, filename)
        self.bind(path)
        return read_json(path)

    def protocol_check(self, protocol):
        require(protocol["schema"] == "visionary-native-4dgs-v1", "Wrong protocol schema")
        require(protocol["mode"] in ("pilot", "formal"), "Probe output is not an auditable benchmark")
        require(protocol["methods"] == ["visionary"], "Native experiment must contain Visionary only")
        require(protocol["rounds"] == (5 if protocol["mode"] == "formal" else 1) and protocol["framesPerRound"] == 150, "Wrong measured coverage")
        require([protocol[k] for k in ("width", "height", "dpr")] == [1280, 720, 1], "Wrong framebuffer/DPR")
        require(protocol["warmup"] == {"minimumMs": 10000, "minimumFrames": 150}, "Wrong initial warmup")
        require(protocol["betweenRounds"] == {"minimumMs": 1500, "minimumFrames": 30}, "Wrong between-round warmup")
        require(protocol["timeSampling"] == "normalized t=i/149, i=0..149; no source acquisition FPS claimed", "Normalized sampling protocol changed")
        source_hashes = protocol["sourceHashes"]
        required = {"dynamic-native/"+name for name in ("audit.py", "main.ts", "run.cjs", "visionary-adapter.ts", "model-lock.json", "camera.json", "inspect-model.cjs", "vite.config.ts", "index.html", "package.json", "package-lock.json")}
        required.update({"runner/common.cjs", "work/visionary/src/ONNX/onnx_generator.ts", "work/visionary/src/point_cloud/dynamic_point_cloud.ts", "work/visionary/src/renderer/gaussian_renderer.ts", "work/visionary/src/shaders/preprocess.wgsl", "work/bench-visionary/camera.ts"})
        require(required <= source_hashes.keys(), "Incomplete native source identity")
        for relative, expected in source_hashes.items():
            self.bind(child(ROOT, relative), expected)
        shader = (ROOT/"work/visionary/src/shaders/preprocess.wgsl").read_text()
        shader = re.sub(r"/\*.*?\*/|//[^\n]*", "", shader, flags=re.S)
        preprocess = shader[shader.index("fn preprocess("):]
        cull = re.search(r"if\s*\(\s*opacity\s*<\s*0\.02\s*\)\s*\{\s*return\s*;\s*\}", preprocess)
        cov = re.search(r"let\s+cov_sparse\s*=\s*cov_coefs\(idx\)", preprocess)
        require(cull and cov and cull.end() < cov.start() and re.search(r"var\s+opacity\s*=\s*pos_op\.w\s*\*\s*uModel\.opacityScale", preprocess), "Frozen shader does not prove strict opacity cull before covariance load")
        adapter_source = (ROOT/"dynamic-native/visionary-adapter.ts").read_text()
        require(re.search(r"pointCloud\.setOpacityScale\(1\)", adapter_source), "Native opacity scale is not fixed at one")
        self.cull_evidence = {"shaderPath":"work/visionary/src/shaders/preprocess.wgsl", "shaderSha256":source_hashes["work/visionary/src/shaders/preprocess.wgsl"], "opacityScale":1, "threshold":.02, "comparison":"opacity < 0.02 returns before cov_coefs(idx)", "gpuOutputsModified":False}
        bootstrap_match = re.search(r"const bootstrapModel = new Uint8Array\(\[([0-9,]+)\]\)", (ROOT/"dynamic-native/visionary-adapter.ts").read_text())
        require(bootstrap_match is not None, "Missing auditable device bootstrap graph")
        bootstrap_bytes = bytes(int(x) for x in bootstrap_match.group(1).split(","))
        self.bootstrap_sha = hashlib.sha256(bootstrap_bytes).hexdigest()
        bootstrap_model = proto_map(bootstrap_bytes); bootstrap_graph = proto_map(bootstrap_model[7][0])
        require(bootstrap_model[1] == [8] and [text_field(proto_map(n), 4) for n in bootstrap_graph[1]] == ["Identity"] and not bootstrap_graph.get(5), "Device bootstrap is not an unweighted Identity graph")
        require([value_info(v) for v in bootstrap_graph[11]] == [{"name":"x","dataType":1,"shape":[1]}] and [value_info(v) for v in bootstrap_graph[12]] == [{"name":"y","dataType":1,"shape":[1]}], "Wrong device bootstrap tensor contract")
        dependencies = protocol["dependencyHashes"]
        critical = {"dynamic-native/node_modules/onnxruntime-web/"+name for name in (
            "package.json", "dist/ort.webgpu.bundle.min.mjs", "dist/ort-wasm-simd-threaded.jsep.mjs", "dist/ort-wasm-simd-threaded.jsep.wasm")}
        require(critical <= dependencies.keys(), "Actual ORT JS/WASM payload identities missing")
        installed_files = {os.path.relpath(p, ROOT) for p in (ROOT/"dynamic-native/node_modules").rglob("*") if p.is_file() and p.suffix in (".js", ".mjs", ".wasm", ".json")}
        require(installed_files == dependencies.keys(), "ORT dependency inventory omits/adds executable or metadata files")
        for relative, expected in dependencies.items():
            self.bind(child(ROOT, relative), expected)
        package = read_json(ROOT/"dynamic-native/node_modules/onnxruntime-web/package.json")
        lock = read_json(ROOT/"dynamic-native/package-lock.json")
        require(package["version"] == "1.22.0" and lock["packages"]["node_modules/onnxruntime-web"]["version"] == "1.22.0", "Wrong installed/locked ORT version")
        require(read_json(ROOT/"dynamic-native/package.json")["dependencies"]["onnxruntime-web"] == "1.22.0", "ORT is not exactly pinned")
        model_lock = protocol["modelLock"]
        require(read_json(ROOT/"dynamic-native/model-lock.json") == model_lock, "Embedded model lock differs")
        require(model_lock["sourceAcquisitionFps"] is None and model_lock["timeDomain"] == [0, 1], "Unsubstantiated source FPS/time domain")
        model_path = (ROOT/protocol["modelPath"]).resolve()
        require(model_path.name == model_lock["filename"], "Model filename differs from locked asset")
        self.model_url = "/data/" + model_lock["filename"]
        require(model_path.parent == (ROOT/protocol["dataRoot"]).resolve(), "Model is outside declared data root")
        self.bind(model_path, model_lock["sha256"], model_lock["bytes"])
        actual = model_info(model_path)
        require(actual == protocol["modelInfo"], "Independent ONNX signature/operator inventory differs")
        require(actual["inputs"] == [{"name": "time", "dataType": 1, "shape": [1]}], "Unexpected ONNX input contract")
        outputs = {x["name"]: x for x in actual["outputs"]}
        require(set(outputs) == {"gaussian_f16", "color_sh", "num_points"}, "Unexpected output contract")
        capacity = integer(outputs["gaussian_f16"]["shape"][0], "ONNX capacity", 1)
        require(outputs["gaussian_f16"] == {"name": "gaussian_f16", "dataType": 10, "shape": [capacity, 10]}, "Wrong native Gaussian encoding")
        require(outputs["color_sh"] == {"name": "color_sh", "dataType": 10, "shape": [capacity, 48]}, "Wrong native SH encoding")
        require(outputs["num_points"] == {"name": "num_points", "dataType": 6, "shape": [1]}, "Wrong active-count output")
        self.capacity = capacity
        self.bind(ROOT/"dynamic-native/camera.json", protocol["cameraSha256"])
        require(read_json(ROOT/"dynamic-native/camera.json") == protocol["camera"], "Fixed camera differs from frozen file")
        host = protocol["host"]
        require(host["platform"] == "darwin" and host["architecture"] == "arm64", "Expected native Apple Silicon Mac")
        require(host["acLowPowerMode"] in (None, 0), "AC low-power mode enabled")
        power(host["power"])
        require("ProductVersion" in host["osVersion"] and "BuildVersion" in host["osVersion"], "Actual OS/build unavailable")
        self.bind(Path(host["browserExecutable"]), host["browserSha256"])
        require(host["browserFrameworkIdentity"], "Missing Chrome framework identity")
        for framework in host["browserFrameworkIdentity"]:
            self.bind(Path(framework["path"]), framework["sha256"])

    def runtime_check(self, runtime, complete):
        require(runtime["complete"] is True and complete["complete"] is True, "Run did not complete")
        require(not any(runtime.get(k) for k in ("error", "signal", "cleanupError")), "Run interrupted/failed cleanup")
        require(runtime["gpuLockReleased"] is True, "GPU lock not released")
        require(Path(runtime["output"]).resolve() == self.run, "Runtime output mismatch")
        require(stamp(runtime["startedAt"]) <= stamp(complete["completedAt"]) <= stamp(runtime["finishedAt"]), "UTC runtime timing reversed")
        children = runtime["ownedChildren"]
        require(len(children) == len(runtime["ownedPids"]) == 3, "Expected one owned browser, server and caffeinate")
        require({x["pid"] for x in children} == {x["pid"] for x in runtime["ownedPids"]}, "Owned PID coverage mismatch")
        require({x["kind"] for x in children} == {"chrome", "vite", "caffeinate"} and all(x["alive"] is False for x in children), "Owned process survived or missing ownership")
        for process in children:
            try:
                os.kill(integer(process["pid"], "owned PID", 1), 0)
            except ProcessLookupError:
                continue
            except PermissionError:
                raise Invalid("Owned PID exists but cannot be inspected")
            raise Invalid(f"Owned PID is still alive (or reused): {process['pid']}")
        host, final = self.protocol["host"], runtime["finalBrowser"]
        for field in ("browserSha256", "browserFrameworkIdentity", "browserVersion"):
            require(final[field] == host[field], "Chrome identity changed during measurement")

    def lifecycle_check(self, item, inference, rendered, inspections, disposed=False):
        life = item["lifecycle"]
        require(life["failed"] is False and life["disposed"] is disposed and life["cleanupErrors"] == [], "Resource failure/cleanup error")
        for key in ("inferenceAttempts", "inferenceCompleted", "strictCountReadbacks"):
            require(life[key] == inference, f"{key}: missing/failed native inference")
        require(life["renderedSamples"] == rendered and life["inspectionCalls"] == inspections, "Render/inspection count differs")
        require(life["loadAttempts"] == life["loadsCompleted"] == 1, "Model was not loaded exactly once")
        for created, destroyed, live, expected in (
            ("pointCloudsCreated", "pointCloudsDestroyed", "activePointClouds", 1),
            ("pointCloudBuffersCreated", "pointCloudBuffersDestroyed", "livePointCloudBuffers", 3),
            ("generatorBuffersCreated", "generatorBuffersDestroyed", "liveGeneratorBuffers", 6),
            ("generatorSessionsCreated", "generatorSessionsReleased", "liveGeneratorSessions", 1),
        ):
            for key in (created, destroyed, live): integer(life[key], key)
            require(life[created] - life[destroyed] == life[live] == (0 if disposed else expected), f"Unbalanced ownership: {live}")
        require(life["generatorSessionsCreated"] == 1, "Expected one native ONNX session")
        for key in ("outputBufferRebindings", "rendererBufferAllocations", "rendererBufferBytes", "rendererGlobalCapacity"):
            integer(life[key], key)
        if rendered:
            require(life["rendererGlobalCapacity"] == life["rendererSteadyStateCapacity"] and life["rendererBufferAllocations"] == life["rendererSteadyStateBufferAllocations"], "Renderer grew after declared steady state")
        if hasattr(self, "steady") and not disposed:
            for key, value in self.steady.items():
                require(life[key] == value, f"Post-warmup owned resource counter changed: {key}")
        return life

    def identity_check(self, item, inference, rendered, inspections, metadata=False, zero_count=False, disposed=False):
        require(item["assetGeneration"] == 1 and item["currentInputUrl"] == self.model_url, "Wrong native model binding")
        require(item["capacity"] == self.capacity, "Output capacity changed")
        count = integer(item["gaussianCount"], "active Gaussian count", 0 if zero_count else 1)
        require(count <= self.capacity, "Active count exceeds allocated capacity")
        require(item["inferenceGeneration"] == inference and item["renderGeneration"] == rendered, "Skipped/stale inference or rendered generation")
        if not metadata:
            require(item["actualCount"] == count, "Actual-count aliases disagree")
            ids = item["outputBufferIds"]
            require(len(ids) == len(set(ids)) == 3 and all(type(v) is int and v > 0 for v in ids), "Invalid shared native output buffer IDs")
            if hasattr(self, "steady_ids"):
                require(ids == self.steady_ids, "Shared GPU output buffer identities changed during timed sequence")
        self.lifecycle_check(item, inference, rendered, inspections, disposed)
        return count

    def metadata_check(self, metadata, loaded=True):
        require(metadata["engine"] == "visionary" and metadata["version"] == "1.0.1" and metadata["sourceCommit"] == "e50f3f6c7200be0516567f0830e5240dfa26d27d", "Wrong native renderer version")
        require(metadata["ortVersion"] == "1.22.0" and metadata["ortExecutionProvidersRequested"] == ["webgpu"], "Wrong ORT/provider")
        require(metadata["ortNodePlacementVerified"] is False, "Unsupported assertion about per-node GPU placement")
        boot = metadata["deviceBootstrap"]
        require(boot["modelSha256"] == self.bootstrap_sha and boot["sessionsCreated"] == boot["sessionsReleased"] == boot["requestDeviceCalls"] == 1 and boot["liveSessions"] == 0 and boot["sameDevice"] is True, "Device bootstrap ownership/identity mismatch")
        require(set(boot["requestedFeatures"]) == set(boot["originalRequiredFeatures"]) | {"timestamp-query"} and "shader-f16" in boot["requestedFeatures"], "Bootstrap changed ORT features beyond declared timestamps")
        original_limits, requested_limits = boot["originalRequiredLimits"], boot["requestedLimits"]
        require(set(requested_limits) == set(original_limits) | {"maxStorageBuffersPerShaderStage"}, "Bootstrap changed undeclared limit keys")
        for key, value in original_limits.items():
            if key != "maxStorageBuffersPerShaderStage": require(requested_limits[key] == value, "Bootstrap altered undeclared ORT limits")
        require(integer(requested_limits["maxStorageBuffersPerShaderStage"], "requested storage bindings", 1) >= original_limits.get("maxStorageBuffersPerShaderStage", 0), "Bootstrap lowered native binding limit")
        require(metadata["timestampSupported"] is True and metadata["timestampWriteCount"] == 6 and metadata["timingMode"] == "stages", "Invalid native GPU timestamps")
        require(metadata["kernelSize"] == .3 and metadata["nativeOpacityCull"] == .02 and metadata["opacityScale"] == 1, "Native renderer parameters changed")
        require(metadata["dynamicUpdateMode"] == "official-ONNXGenerator-direct-generate" and metadata["sourcePatches"] == [] and metadata["algorithmModified"] is False, "Non-native dynamic algorithm")
        require([metadata[k] for k in ("width", "height", "sortBits")] == [1280, 720, 32], "Wrong render dimensions/sort")
        require(metadata["lod"] is False and metadata["background"] == "#000000" and metadata["screenPresentationMeasured"] is False and metadata["gpuInferenceTimingAvailable"] is False, "Incorrect protocol claims")
        gpu = metadata["gpuAdapter"]
        description = json.dumps(gpu).lower()
        require("apple" in description and not any(x in description for x in ("swiftshader", "llvmpipe", "software adapter")) and gpu["isFallbackAdapter"] is not True, "Non-native Apple GPU")
        require(not metadata.get("lastError") and not metadata.get("events"), "Adapter/browser runtime errors")
        if loaded:
            require(metadata["ortDeviceShared"] is True, "ORT and renderer do not share GPUDevice")
            require(metadata["graphCaptureRequested"] is True and metadata["graphCaptureEnabled"] is True and metadata["graphCaptureFallbackObserved"] is False and metadata["graphCaptureFallbackAllowed"] is False and metadata["initializationAlerts"] == [], "Graph capture fell back/initialization alert")
            require(metadata["inputNames"] == ["time"] and set(metadata["outputNames"]) == {"gaussian_f16", "color_sh", "num_points"}, "Native runtime model signature mismatch")
            require(metadata["cameraDependentInputs"] is False and metadata["colorChannels"] == 48 and metadata["colorMode"] == "sh" and metadata["shDegree"] == metadata["modelShDegree"] == 3, "Unexpected native output interpretation")
            for field in ("gaussianPrecision", "colorPrecision"):
                require(metadata[field]["dataType"] == "float16" and metadata[field]["bytesPerElement"] == 2, "Model output precision changed")
            require(metadata["capacity"] == self.capacity, "Runtime model capacity differs from ONNX signature")
            finite(metadata["loadMs"], "model initialization time", positive=True)

    def inspect_check(self, item, time, inference, rendered, inspections, count_expected, full=False):
        count = self.identity_check(item, inference, rendered, inspections)
        require(item["outsideMeasuredSamples"] is True and item["onnxInputTime"] == f32(time), "Inspection inference time mismatch")
        n = min(count, count_expected)
        require(item["sampleCount"] == n and n >= 2, "Wrong inspection coverage")
        rows = [math.floor(i * (count-1)/(n-1)) for i in range(n)]
        require(item["rowIndices"] == rows and item["colorChannels"] == 48, "GPU row sampling contract differs")
        decoded = {}
        for kind, width in (("gaussian", 10), ("color", 48)):
            precision = item[kind+"Precision"]
            require(precision["dataType"] == "float16" and precision["bytesPerElement"] == 2, "Inspection precision mismatch")
            data = base64.b64decode(item[kind+"BytesBase64"], validate=True)
            require(len(data) == n * width * 2 and hashlib.sha256(data).hexdigest() == item[kind+"Sha256"], "GPU content bytes/SHA mismatch")
            values = list(struct.unpack("<"+"e"*(n*width), data))
            require(all(math.isfinite(v) for v in values), "Nonfinite decoded GPU content")
            decoded[kind] = [values[i*width:(i+1)*width] for i in range(n)]
        require(len(item["samples"]) == n, "Inspection decoded rows missing")
        for j, row in enumerate(item["samples"]):
            require(row == {"index": rows[j], "gaussian": decoded["gaussian"][j], "color": decoded["color"][j]}, "Independent fp16 decoding differs")
        bounds = item["fullBounds"]
        if full:
            require(bounds["inspectedCount"] == count, "Active Gaussian bounds not fully inspected")
            nonfinite_evidence(bounds, self.capacity, time)
            require(0 < integer(bounds["selectedCount"], "visible-alpha bounds count", 1) <= count, "Invalid bounds coverage")
            require(bounds["fieldNames"] == GAUSSIAN_FIELDS, "Wrong native covariance layout")
            for low, high, length in ((bounds["min"], bounds["max"], 3), (bounds["fieldMin"], bounds["fieldMax"], 10)):
                require(len(low) == len(high) == length and all(math.isfinite(x) for x in low+high) and all(a <= b for a, b in zip(low, high)), "Invalid actual-model bounds")
            require(any(a < b for a, b in zip(bounds["min"], bounds["max"])), "Degenerate model bounds")
            for row in decoded["gaussian"]:
                require(all(a <= v <= b for a, v, b in zip(bounds["fieldMin"], row, bounds["fieldMax"])), "Decoded row escapes recorded full bounds")
        else:
            require(bounds is None, "Capture inspection unexpectedly claims full bounds")
        return {"gaussianSha256": item["gaussianSha256"], "colorSha256": item["colorSha256"], "decoded": decoded, "count": count}

    def sample_check(self, item, index, inference, rendered, inspections, repeat=None):
        self.identity_check(item, inference, rendered, inspections)
        require(item["index"] == index and item["requestedTime"] == item["time"] == index/149 and item["onnxInputTime"] == f32(index/149), "Wrong/skipped normalized frame time")
        require(item["cameraSpec"] == self.protocol["camera"], "Camera moved during true-content dynamic test")
        if repeat is not None: require(item["repeat"] == repeat, "Wrong repeat number")
        require(item["sortGeneration"] == inference and item["freshSort"] is True and item["generateCompleted"] is True and item["strictCountVerified"] is True, "Stale/missing inference or sorting")
        require(item["timingMode"] == "stages", "Unexpected timestamp mode")
        matrices = {key: item[key] for key in ("cameraMatrix", "projectionMatrix")}
        for matrix in matrices.values():
            require(len(matrix) == 16 and all(type(v) in (float, int) and math.isfinite(v) for v in matrix), "Invalid camera matrix")
        if hasattr(self, "matrices"): require(matrices == self.matrices, "Rendered camera matrix changed")
        else: self.matrices = matrices
        values = [finite(item[key], key) for key in ("e2eStartMs", "sampleStartMs", "sampleEndMs", "e2eEndMs")]
        require(values == sorted(values), "CPU sample completion boundaries reversed")
        close(item["e2eCompletionMs"], values[3]-values[0], "outer E2E")
        close(item["wallMs"], values[2]-values[1], "native adapter wall")
        finite(item["e2eCompletionMs"], "E2E", positive=True)
        for key in ("inferenceWallMs", "inferenceAndBindingWallMs", "renderCompletionMs", "renderGpuCompleteWallMs", "cpuSubmitMs"):
            finite(item[key], key)
        require(item["inferenceWallMs"] <= item["inferenceAndBindingWallMs"]+1e-6 and item["inferenceAndBindingWallMs"]+item["renderCompletionMs"] <= item["wallMs"]+1e-6, "Inference/render phases escape native wall")
        require(item["cpuSubmitMs"] <= item["renderGpuCompleteWallMs"]+1e-6 <= item["renderCompletionMs"]+2e-6, "GPU completion/readback phase ordering differs")
        require(0 <= integer(item["visibleSplats"], "visible count") <= item["gaussianCount"], "Visible count exceeds active model count")
        gpu = item["gpu"]
        require(gpu["timestampWriteCount"] == 6 and gpu["passSumMs"] is None and gpu["passTimings"] == [], "Wrong stages query count")
        stages = gpu["stageTimings"]
        require([x["stage"] for x in stages] == ["prep", "sort", "draw"] and [(x["start"], x["end"]) for x in stages] == [(0,1),(2,3),(4,5)], "GPU stage boundaries changed")
        for field, stage in zip(("prepMs", "sortMs", "drawMs"), stages): close(gpu[field], stage["ms"], field)
        finite(gpu["totalMs"], "GPU renderer span")
        require(sum(gpu[k] for k in ("prepMs", "sortMs", "drawMs")) <= gpu["totalMs"]+1e-6, "Non-monotonic native same-domain timestamp spans")
        return item["e2eCompletionMs"]

    def warmup_check(self, value, inference, rendered, inspections, policy):
        frames = integer(value["frames"], "warmup frames", policy["minimumFrames"])
        require(finite(value["elapsedMs"], "warmup wall") >= policy["minimumMs"], "Insufficient warmup duration")
        for metadata, i, r in ((value["before"], inference, rendered), (value["after"], inference+frames, rendered+frames)):
            self.metadata_check(metadata)
            self.identity_check(metadata, i, r, inspections, metadata=True)
        require(value["after"]["onnxInputTime"] == f32(((frames-1) % 150)/149), "Warmup final normalized time mismatch")
        return inference+frames, rendered+frames

    def record_check(self, record):
        require(record["method"] == "visionary" and record["status"] == "complete" and record["protocolSha256"] == self.protocol_sha and record["errors"] == [] and not record.get("error"), "Incomplete/failed/wrong raw record")
        require(record["browserVersion"] in self.protocol["host"]["browserVersion"], "Actual browser version mismatch")
        initial = record["initial"]
        require([initial[k] for k in ("width", "height", "devicePixelRatio")] == [1280,720,1] and initial["crossOriginIsolated"] is True, "Wrong framebuffer/isolation")
        self.metadata_check(initial["metadata"], loaded=False)
        load = record["loadInfo"]
        self.identity_check(load, 0, 0, 0, zero_count=True)
        require(load["gaussianCount"] == 0 and load["shDegree"] == 3 and load["colorChannels"] == 48 and load["inputNames"] == ["time"], "Native model load contract mismatch")
        finite(load["loadMs"], "load time", positive=True)
        self.inspect_check(record["inspectionStart"], 0, 1, 0, 1, 256, full=True)
        inference, rendered, inspections = 1, 0, 1
        sweep = record["contentSweep"]
        require(len(sweep) == 150, "Missing all-time content validation sweep")
        sweep_rows = []
        for index, inspection in enumerate(sweep):
            require(inspection["index"] == index and inspection["requestedTime"] == index/149, "Content sweep skips/changes a normalized time")
            inference += 1; inspections += 1
            self.inspect_check(inspection, index/149, inference, rendered, inspections, 2, full=True)
            sweep_rows.append({"index":index,"requestedTime":index/149,"onnxInputTime":f32(index/149),"activeCount":inspection["gaussianCount"], **nonfinite_evidence(inspection["fullBounds"],self.capacity,index/149)})
        inference, rendered = self.warmup_check(record["warmup"], inference, rendered, inspections, self.protocol["warmup"])
        life = record["warmup"]["after"]["lifecycle"]
        self.steady = {key: life[key] for key in ("rendererBufferAllocations", "rendererBufferBytes", "rendererGlobalCapacity", "pointCloudsCreated", "pointCloudBuffersCreated", "generatorBuffersCreated", "outputBufferRebindings")}
        rounds = record["rounds"]
        require(len(rounds) == self.protocol["rounds"], "Wrong complete round coverage")
        observations, all_samples, round_rows, total_window, prior_end = [], [], [], 0, 0
        for repeat, round_ in enumerate(rounds):
            require(round_["repeat"] == repeat, "Round order changed")
            if repeat:
                inference, rendered = self.warmup_check(round_["warmup"], inference, rendered, inspections, self.protocol["betweenRounds"])
            else: require(round_["warmup"] is None, "First round duplicates between-round warmup")
            before, after = power(round_["powerBefore"]), power(round_["powerAfter"])
            require(before <= after, "Round AC observations reversed")
            observations.extend([before, after])
            start, end = finite(round_["windowStartMs"], "round start"), finite(round_["windowEndMs"], "round end")
            close(round_["windowElapsedMs"], end-start, "round window")
            require(start >= prior_end and end > start, "Measured windows overlap/reverse")
            require(len(round_["samples"]) == 150, "Missing normalized content frames")
            cursor = start
            for index, sample in enumerate(round_["samples"]):
                inference += 1; rendered += 1
                self.sample_check(sample, index, inference, rendered, inspections, repeat)
                if not hasattr(self, "steady_ids"): self.steady_ids = sample["outputBufferIds"]
                require(cursor <= sample["e2eStartMs"] <= sample["e2eEndMs"] <= end, "Sample overlaps/escapes its full window")
                cursor = sample["e2eEndMs"]
                all_samples.append(sample)
            self.metadata_check(round_["metadata"])
            self.identity_check(round_["metadata"], inference, rendered, inspections, metadata=True)
            require(round_["metadata"]["onnxInputTime"] == 1, "Round omitted final normalized time")
            total_window += round_["windowElapsedMs"]; prior_end = end
            stats = summary([x["e2eCompletionMs"] for x in round_["samples"]])
            round_rows.append({"repeat": repeat, "sampleCount":150, **stats, "windowElapsedMs":round_["windowElapsedMs"], "completedFramesPerSecond":150000/round_["windowElapsedMs"]})
        captures = record["captures"]
        require([c["index"] for c in captures] == CAPTURE_INDICES, "Capture normalized-time coverage differs")
        image_rows, content_rows, png_pixels = [], [], []
        from PIL import Image
        for capture in captures:
            index = capture["index"]
            require(capture["time"] == index/149 and capture["path"] == f"captures/visionary-{index:03}.png", "Capture time/path differs")
            inference += 1; rendered += 1
            self.sample_check(capture["metric"], index, inference, rendered, inspections)
            require(capture["metric"]["e2eStartMs"] >= prior_end, "Capture overlaps measured timing")
            prior_end = capture["metric"]["e2eEndMs"]
            # Capture inspection reads exactly the just-rendered buffers; it must
            # not advance native inference or renderer generation.
            inspections += 1
            content = self.inspect_check(capture["inspection"], index/149, inference, rendered, inspections, 64)
            require(capture["inspection"]["outputBufferIds"] == capture["metric"]["outputBufferIds"] and capture["inspection"]["gaussianCount"] == capture["metric"]["gaussianCount"], "Capture inspection does not bind the rendered buffers/count")
            content_rows.append(content)
            path = child(self.run, capture["path"])
            require(path.suffix.lower() == ".png", "Capture is not lossless PNG")
            self.bind(path, capture["sha256"])
            with Image.open(path) as image:
                require(image.format == "PNG" and image.size == (1280,720), "Capture framebuffer differs")
                rgb = image.convert("RGB"); extrema = rgb.getextrema(); pixels = rgb.tobytes()
                require(any(high > 0 for low, high in extrema) and any(low < high for low, high in extrema), "Capture black/constant")
            png_pixels.append(pixels)
            image_rows.append({"index":index, "time":index/149, "path":capture["path"], "sha256":capture["sha256"], "rgbSha256":hashlib.sha256(pixels).hexdigest(), "gaussianSha256":content["gaussianSha256"], "colorSha256":content["colorSha256"], "activeCount":content["count"]})
        require(len({x["gaussianSha256"] for x in content_rows}) > 1, "No observed dynamic Gaussian buffer change")
        require(len({x["rgbSha256"] for x in image_rows}) > 1, "No rendered pixel change under fixed camera")
        comparable = [x for x in content_rows[1:] if x["count"] == content_rows[0]["count"]]
        geometry_changed = any(any(a[k] != b[k] for a, b in zip(content_rows[0]["decoded"]["gaussian"], x["decoded"]["gaussian"]) for k in (0,1,2,4,5,6,7,8,9)) for x in comparable)
        require(geometry_changed or len({x["count"] for x in content_rows}) > 1, "No geometry/covariance/count change; color-only dynamic model is outside this experiment")
        self.metadata_check(record["metadata"])
        self.identity_check(record["metadata"], inference, rendered, inspections, metadata=True)
        require(record["metadata"]["onnxInputTime"] == 1 and record["metadata"]["events"] == [], "Final normalized time/runtime events differ")
        disposal = record["disposal"]
        require(disposal["events"] == [] and disposal["metadata"]["disposed"] is True, "Disposal missing/errored")
        self.metadata_check(disposal["metadata"])
        self.identity_check(disposal["metadata"], inference, rendered, inspections, metadata=True, disposed=True)
        telemetry_path = child(self.run, record["telemetryPath"])
        self.bind(telemetry_path, record["telemetrySha256"])
        telemetry = read_json(telemetry_path)
        require(telemetry["error"] is None and len(telemetry["samples"]) >= 2, "Power telemetry failed/missing")
        power_times = [power(x) for x in telemetry["samples"]]
        require(power_times == sorted(power_times), "Power telemetry timestamps reversed")
        require(stamp(record["startedAt"]) <= power_times[0] <= observations[0] and observations[-1] <= power_times[-1] <= stamp(record["completedAt"]), "AC telemetry does not span measured rounds")
        require(power(record["powerEnd"]) >= stamp(record["completedAt"]), "Missing final AC observation")
        for observed in observations:
            require(stamp(record["startedAt"]) <= observed <= stamp(record["completedAt"]), "AC observation escapes raw interval")
        values = [s["e2eCompletionMs"] for s in all_samples]
        e2e = {"sampleCount":len(values), **summary(values), "totalWindowMs":total_window, "completedFramesPerSecond":1000*len(values)/total_window}
        require(record["e2e"].keys() == e2e.keys(), "Incomplete E2E summary")
        for key, value in e2e.items(): close(record["e2e"][key], value, "E2E "+key)
        phases = {key:summary([s[key] for s in all_samples]) for key in ("inferenceWallMs", "renderCompletionMs")}
        require(record["phases"].keys() == phases.keys(), "Missing independent phase summaries")
        for phase, stats in phases.items():
            for key, value in stats.items(): close(record["phases"][phase][key], value, phase+" "+key)
        counts = [s["gaussianCount"] for s in all_samples]
        return {"method":"visionary", "e2e":e2e, "phases":phases, "rounds":round_rows, "captures":image_rows,
                "contentValidation":{"capacity":self.capacity, "activeCountMin":min(counts), "activeCountMax":max(counts), "exactFloat32Times":150, "sampledFp16BytesDecoded":True, "captureInspectionUsesRenderedGeneration":True, "additionalInspectionInferences":151, "fullContentSweep":sweep_rows, "nativeOpacityCullEvidence":self.cull_evidence, "allSweepRenderableGaussianFieldsFinite":True, "nonfiniteCulledRowsAcrossSweep":sum(x["nonfiniteCulledGaussianCount"] for x in sweep_rows), "geometryChanged":geometry_changed, "fixedCamera":True, "distinctGaussianCaptureHashes":len({x['gaussianSha256'] for x in content_rows}), "distinctRgbCaptureHashes":len({x['rgbSha256'] for x in image_rows}), "notSourceAcquisitionFps":True},
                "resourceValidation":{"inferenceGeneration":inference, "renderGeneration":rendered, "inspectionCalls":inspections, "steadyCounters":self.steady, "sharedOutputBufferIds":self.steady_ids, "deviceBootstrap":record["metadata"]["deviceBootstrap"], "disposal":disposal["metadata"]["lifecycle"]},
                "powerTelemetrySamples":len(power_times), "gpuRendererSpanExceedsE2eSamples":sum(s["gpu"]["totalMs"] > s["e2eCompletionMs"] for s in all_samples)}

    def execute(self):
        require(self.run.is_dir(), "Run directory does not exist")
        require(not (ROOT/"results/gpu-session.lock").exists(), "A GPU measurement is still locked; CPU audit must wait")
        self.protocol = self.load("protocol.json")
        self.protocol_sha = self.sources[str(self.run/"protocol.json")]["sha256"]
        require(self.protocol["mode"] in ("pilot", "formal"), "Probe output is rejected")
        runtime, complete = self.load("runtime.json"), self.load("complete.json")
        self.runtime_check(runtime, complete)
        self.protocol_check(self.protocol)
        require(len(complete["methods"]) == 1 and complete["methods"][0]["method"] == "visionary", "Completion does not bind Visionary only")
        self.bind(self.run/"visionary.json", complete["methods"][0]["sha256"])
        record = read_json(self.run/"visionary.json")
        require(stamp(runtime["startedAt"]) <= stamp(record["startedAt"]) <= stamp(record["completedAt"]) <= stamp(runtime["finishedAt"]), "Raw UTC interval escapes runtime")
        self.records.append(self.record_check(record))


def self_test():
    class Checks(unittest.TestCase):
        def specimen(self, inference=1, rendered=1, inspections=0):
            life = {"failed":False,"disposed":False,"cleanupErrors":[],"loadAttempts":1,"loadsCompleted":1,
                    "inferenceAttempts":inference,"inferenceCompleted":inference,"strictCountReadbacks":inference,
                    "renderedSamples":rendered,"inspectionCalls":inspections,"pointCloudsCreated":1,"pointCloudsDestroyed":0,"activePointClouds":1,
                    "pointCloudBuffersCreated":3,"pointCloudBuffersDestroyed":0,"livePointCloudBuffers":3,
                    "generatorBuffersCreated":6,"generatorBuffersDestroyed":0,"liveGeneratorBuffers":6,
                    "generatorSessionsCreated":1,"generatorSessionsReleased":0,"liveGeneratorSessions":1,
                    "outputBufferRebindings":0,"rendererBufferAllocations":12,"rendererBufferBytes":512,"rendererGlobalCapacity":16,
                    "rendererSteadyStateCapacity":16,"rendererSteadyStateBufferAllocations":12}
            return {"assetGeneration":1,"currentInputUrl":"/data/gaussians4d.onnx","capacity":16,"gaussianCount":2,"actualCount":2,
                    "inferenceGeneration":inference,"renderGeneration":rendered,"outputBufferIds":[1,2,3],"lifecycle":life}
        def test_quantile(self):
            self.assertEqual(quantile([4, 1, 3, 2], .5), 2.5)
            self.assertAlmostEqual(quantile([1, 2, 3, 4], .95), 3.85)
        def test_float32_time(self):
            self.assertEqual(f32(0), 0)
            self.assertEqual(f32(1), 1)
            self.assertNotEqual(f32(1/149), 1/149)
            self.assertEqual(len({f32(i/149) for i in range(150)}), 150)
        def test_nonfinite(self):
            for value in (None, True, float("nan"), float("inf"), -1):
                with self.assertRaises(Invalid):
                    finite(value, "fixture")
        def test_protobuf(self):
            self.assertEqual([(n, w, int(v) if w == 0 else bytes(v)) for n, w, v in proto_fields(b"\x08\x11\x12\x04time")], [(1, 0, 17), (2, 2, b"time")])
            with self.assertRaises(Invalid):
                list(proto_fields(b"\x12\x04tim"))
            # ValueInfo: time, TensorProto float32 [1].
            value = b"\x0a\x04time\x12\x0a\x0a\x08\x08\x01\x12\x04\x0a\x02\x08\x01"
            self.assertEqual(value_info(value), {"name": "time", "dataType": 1, "shape": [1]})
        def test_paths(self):
            with self.assertRaises(Invalid):
                child(ROOT, "../escape")
        def test_resource_counter_leak(self):
            audit = Audit(ROOT); audit.capacity = 16; audit.model_url = "/data/gaussians4d.onnx"
            item = self.specimen()
            self.assertEqual(audit.identity_check(item, 1, 1, 0), 2)
            item["lifecycle"]["liveGeneratorBuffers"] += 1
            with self.assertRaises(Invalid): audit.identity_check(item, 1, 1, 0)
        def test_stale_generation_rejected(self):
            audit = Audit(ROOT); audit.capacity = 16; audit.model_url = "/data/gaussians4d.onnx"
            with self.assertRaises(Invalid): audit.identity_check(self.specimen(), 2, 1, 0)
        def test_independent_fp16_inspection(self):
            audit = Audit(ROOT); audit.capacity = 16; audit.model_url = "/data/gaussians4d.onnx"
            item = self.specimen(inference=1, rendered=0, inspections=1)
            item.update({"outsideMeasuredSamples":True,"onnxInputTime":f32(50/149),"sampleCount":2,"rowIndices":[0,1],"colorChannels":48,"fullBounds":None})
            item["samples"] = [{"index":i,"gaussian":[float(i+k) for k in range(10)],"color":[float(i) for k in range(48)]} for i in range(2)]
            for kind, width in (("gaussian",10),("color",48)):
                data = struct.pack("<"+"e"*(2*width), *(v for row in item["samples"] for v in row[kind]))
                item[kind+"Precision"] = {"dataType":"float16","bytesPerElement":2}
                item[kind+"BytesBase64"] = base64.b64encode(data).decode()
                item[kind+"Sha256"] = hashlib.sha256(data).hexdigest()
            self.assertEqual(audit.inspect_check(item,50/149,1,0,1,64)["count"],2)
            # inspectCurrent increments only inspectionCalls after rendering.
            item["renderGeneration"] = 1; item["lifecycle"]["renderedSamples"] = 1
            item["lifecycle"]["inspectionCalls"] = 2
            self.assertEqual(audit.inspect_check(item,50/149,1,1,2,64)["count"],2)
            item["inferenceGeneration"] = 2
            with self.assertRaises(Invalid): audit.inspect_check(item,50/149,1,1,2,64)
            item["inferenceGeneration"] = 1
            item["samples"][0]["gaussian"][0] = .5
            with self.assertRaises(Invalid): audit.inspect_check(item,50/149,1,1,2,64)
        def test_sample_boundary_and_stale_sort(self):
            audit = Audit(ROOT); audit.capacity = 16; audit.model_url = "/data/gaussians4d.onnx"; audit.protocol = {"camera":{"fixture":True}}
            item = self.specimen()
            item.update({"index":0,"repeat":0,"requestedTime":0,"time":0,"onnxInputTime":0,"cameraSpec":{"fixture":True},
                         "sortGeneration":1,"freshSort":True,"generateCompleted":True,"strictCountVerified":True,"timingMode":"stages",
                         "cameraMatrix":[1 if i%5 == 0 else 0 for i in range(16)],"projectionMatrix":[1 if i%5 == 0 else 0 for i in range(16)],
                         "e2eStartMs":10,"sampleStartMs":10.5,"sampleEndMs":16.5,"e2eEndMs":17,"e2eCompletionMs":7,"wallMs":6,
                         "inferenceWallMs":1.8,"inferenceAndBindingWallMs":2,"renderCompletionMs":3,"renderGpuCompleteWallMs":2.5,"cpuSubmitMs":.5,"visibleSplats":1,
                         "gpu":{"timestampWriteCount":6,"passSumMs":None,"passTimings":[],"prepMs":.2,"sortMs":.5,"drawMs":.3,"totalMs":1.1,
                                "stageTimings":[{"stage":name,"start":2*i,"end":2*i+1,"ms":ms} for i,(name,ms) in enumerate(zip(("prep","sort","draw"),(.2,.5,.3)))]}})
            self.assertEqual(audit.sample_check(item,0,1,1,0,0),7)
            item["sortGeneration"] = 0
            with self.assertRaises(Invalid): audit.sample_check(item,0,1,1,0,0)
            item["sortGeneration"] = 1; item["inferenceAndBindingWallMs"] = 4
            with self.assertRaises(Invalid): audit.sample_check(item,0,1,1,0,0)
        def test_native_cull_requires_finite_position_opacity(self):
            row = [0.,1.,2.,.0039215087890625,1.,0.,float("inf"),1.,0.,1.]
            self.assertEqual(native_culled_nonfinite(row),[6])
            row[3] = float("nan")
            with self.assertRaises(Invalid): native_culled_nonfinite(row)
            row[3] = .001; row[0] = float("inf")
            with self.assertRaises(Invalid): native_culled_nonfinite(row)
        def test_native_cull_threshold_is_strict(self):
            row = [0.,1.,2.,.02,1.,0.,float("inf"),1.,0.,1.]
            with self.assertRaises(Invalid): native_culled_nonfinite(row)
            row[3] = .1
            with self.assertRaises(Invalid): native_culled_nonfinite(row)
        def test_nonfinite_requires_complete_raw_evidence(self):
            row = [0.,1.,2.,.0039215087890625,1.,0.,float("inf"),1.,0.,1.]
            example = {"row":1,"actualCount":2,"capacity":16,"onnxInputTime":0,"precision":{"dataType":"float16","bytesPerElement":2},
                       "fields":GAUSSIAN_FIELDS,"values":[str(v) for v in row],"nonfiniteFields":["cov02"],"rawHex":struct.pack("<10e",*row).hex(),
                       "safelyOpacityCulled":True,"positionOpacityFinite":True,"opacityPassesNativeCull":False}
            bounds = {"inspectedCount":2,"opacityThreshold":.02,"diagnosticNonfiniteEnabled":False,"nonfiniteGaussianCount":1,"nonfiniteCulledGaussianCount":1,
                      "nonfiniteRenderableGaussianCount":0,"allGaussianFieldsFinite":False,"allRenderableGaussianFieldsFinite":True,"nonfiniteExamples":[example],
                      "nonfiniteValueCount":1,"nonfiniteByField":{name:int(name=="cov02") for name in GAUSSIAN_FIELDS}}
            self.assertEqual(nonfinite_evidence(bounds,16,0)["nonfiniteCulledGaussianCount"],1)
            bounds["nonfiniteExamples"] = []
            with self.assertRaises(Invalid): nonfinite_evidence(bounds,16,0)
    return unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Checks)).wasSuccessful()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, help="Completed native pilot/formal output directory")
    parser.add_argument("--self-test", action="store_true", help="Run tiny CPU arithmetic/parser fixtures without a run")
    args = parser.parse_args()
    if args.self_test:
        return 0 if self_test() else 1
    if args.run is None:
        parser.error("--run is required")
    audit = Audit(args.run)
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        audit.execute()
    except Exception as error:
        audit.errors.append(f"{type(error).__name__}: {error}")
    passed = not audit.errors and len(audit.records) == 1
    bound = lambda filename: audit.sources.get(str(audit.run/filename), {}).get("sha256")
    receipt = {
        "schema": "visionary-native-4dgs-independent-audit-v1", "startedAt": started,
        "finishedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "passed": passed, "complete": passed,
        "runDirectory": os.path.relpath(audit.run, ROOT), "mode": audit.protocol.get("mode"),
        "protocolSha256": audit.protocol_sha, "auditorSha256": sha(Path(__file__)),
        "coverage": {"methods": len(audit.records), "rounds": sum(len(x["rounds"]) for x in audit.records),
                     "timedSamples": sum(x["e2e"]["sampleCount"] for x in audit.records),
                     "capturedFrames": sum(len(x["captures"]) for x in audit.records)},
        "definitions": {
            "completedFramesPerSecond": "1000 * completed measured native inference-and-render frames / sum of complete measured round windows",
            "percentiles": "Type-7 linear interpolation of all individual measured E2E samples",
            "normalizedTime": "150 explicitly selected values t=i/149 with exact float32 GPU input; no acquisition FPS or source scene is inferred",
            "renderCompletionMs": "Secondary post-inference phase; excludes model inference and cannot alone represent native dynamic playback FPS",
            "gpuStageTimings": "Native renderer GPU timestamps only; do not invert or add to wall time as independent end-to-end latency",
            "resourceValidation": "Owned lifecycle plus observed post-warmup native buffer counter stability, not physical driver memory measurement",
            "visualValidation": "PNG resolution/nonblack/pixel-change and GPU-buffer-content-change checks; does not assert human visual review",
            "finiteContent": "All 150 normalized times have a full active-row scan recorded by the frozen GPU readback guard; every reported nonfinite row is independently decoded from complete raw bytes and must have finite XYZ/alpha with alpha<0.02, before the original shader reads covariance. No GPU values are clamped, removed, or replaced.",
        },
        "records": audit.records, "errors": audit.errors,
        "sourceReceipts": {"protocolSha256": bound("protocol.json"), "completeSha256": bound("complete.json"),
                           "runtimeSha256": bound("runtime.json"), "methods": {"visionary": bound("visionary.json")}},
        "sourceFiles": list(audit.sources.values()),
    }
    audit.run.mkdir(parents=True, exist_ok=True)
    target = audit.run/"audit.json"
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(receipt, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    temporary.replace(target)
    print(json.dumps({"passed": passed, "audit": str(target), "coverage": receipt["coverage"], "errors": audit.errors}, ensure_ascii=False))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
